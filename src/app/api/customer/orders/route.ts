/*
  Criação de pedido pelo cliente (PWA):
  - Pix / cartão: integra Asaas (checkout transparente)
  - counter: pedido no app · pagamento na tenda/balcão (sem Asaas);
    entra como `pending` até o PDV confirmar o pagamento na maquininha
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { pdvAcceptsAppOrders, pdvPayAtCounter, pdvSellsOnline } from "@/lib/pdv";
import { effectivePrice } from "@/lib/pricing";
import {
  asaasEnabled,
  createCardPayment,
  createPixPayment,
  findOrCreateCustomer,
  getPixQr,
} from "@/lib/asaas";
import { validateStock, decrementStockForOrder } from "@/lib/stock";
import { customerReadyForCard } from "@/lib/customer-profile";
import {
  findSize,
  lineDisplayName,
  parseProductSizes,
} from "@/lib/product-sizes";
import { internalErrorResponse, upstreamErrorResponse } from "@/lib/server-errors";

const CardSchema = z.object({
  holderName: z.string().min(2).max(120),
  number: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{13,19}$/, "Número de cartão inválido")),
  expiryMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/, "Mês inválido"),
  expiryYear: z.string().regex(/^(?:\d{2}|\d{4})$/, "Ano inválido"),
  ccv: z.string().regex(/^\d{3,4}$/),
});

const Body = z.object({
  pdv_id: z.string().uuid(),
  method: z.enum(["pix", "card", "counter"]),
  notes: z.string().max(500).optional().nullable(),
  coupon_code: z.string().max(60).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(99),
        notes: z.string().max(200).optional().nullable(),
        size_label: z.string().max(40).optional().nullable(),
      })
    )
    .min(1),
  card: CardSchema.optional(),
});

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (body.method === "card" && !body.card) {
    return NextResponse.json(
      { error: "Dados do cartão são obrigatórios" },
      { status: 400 }
    );
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (error) {
    return internalErrorResponse(
      "customer-order-client",
      error,
      "Pagamento temporariamente indisponível"
    );
  }

  const { data: pdv, error: ePdv } = await supabase
    .from("pdvs")
    .select("id, venue_id, name, is_open, category, sells_online, pay_at_counter")
    .eq("id", body.pdv_id)
    .maybeSingle();
  if (ePdv || !pdv) return NextResponse.json({ error: "PDV invalido" }, { status: 400 });
  if (!pdv.is_open) return NextResponse.json({ error: "PDV fechado" }, { status: 400 });
  if (!pdvAcceptsAppOrders(pdv))
    return NextResponse.json(
      { error: "Este PDV não aceita pedidos pelo app" },
      { status: 422 }
    );

  const counterCheckout = body.method === "counter";
  if (counterCheckout && !pdvPayAtCounter(pdv)) {
    return NextResponse.json(
      { error: "Este PDV não aceita pagamento no local" },
      { status: 422 }
    );
  }
  if (!counterCheckout && !pdvSellsOnline(pdv)) {
    return NextResponse.json(
      { error: "Este PDV não aceita pagamento pelo app" },
      { status: 422 }
    );
  }

  const productIds = body.items.map((i) => i.product_id);
  const { data: products, error: ePr } = await supabase
    .from("products")
    .select("id, pdv_id, name, price, sale_price, status, sizes")
    .in("id", productIds);
  if (ePr) {
    return internalErrorResponse(
      "customer-order-products",
      ePr,
      "Não foi possível validar os produtos"
    );
  }

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  function resolveLine(it: (typeof body.items)[number]) {
    const p = byId.get(it.product_id)!;
    const sizes = parseProductSizes(p.sizes);
    if (sizes.length > 0) {
      const match = findSize(sizes, it.size_label);
      if (!match) {
        return { error: `Escolha o tamanho de ${p.name}` as string };
      }
      return {
        name: lineDisplayName(p.name, match.label),
        unit_price: match.price,
      };
    }
    return {
      name: p.name,
      unit_price: effectivePrice(p),
    };
  }

  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Produto invalido" }, { status: 400 });
    if (p.pdv_id !== pdv.id)
      return NextResponse.json({ error: "Produto nao pertence ao PDV" }, { status: 400 });
    if (p.status !== "active")
      return NextResponse.json({ error: `Produto indisponivel: ${p.name}` }, { status: 400 });
    const line = resolveLine(it);
    if ("error" in line && line.error) {
      return NextResponse.json({ error: line.error }, { status: 400 });
    }
  }

  const stockError = await validateStock(supabase, body.items);
  if (stockError) return NextResponse.json({ error: stockError }, { status: 400 });

  // Subtotal + cupom
  let couponId: string | null = null;
  let discount = 0;
  const subtotal = body.items.reduce((s, it) => {
    const line = resolveLine(it) as { unit_price: number };
    return s + line.unit_price * it.qty;
  }, 0);

  if (body.coupon_code) {
    const code = body.coupon_code.trim().toUpperCase();
    const { data: coupon, error: couponError } = await supabase
      .from("coupons")
      .select(
        "id, venue_id, type, value, min_order, max_uses, used, is_active, valid_until"
      )
      .eq("code", code)
      .maybeSingle();
    if (couponError) {
      return internalErrorResponse(
        "customer-order-coupon",
        couponError,
        "Não foi possível validar o cupom"
      );
    }
    if (!coupon) {
      return NextResponse.json({ error: "Cupom não encontrado" }, { status: 400 });
    }
    if (!coupon.is_active) {
      return NextResponse.json({ error: "Cupom inativo" }, { status: 400 });
    }
    if (coupon.venue_id && coupon.venue_id !== pdv.venue_id) {
      return NextResponse.json(
        { error: "Cupom não válido para este evento" },
        { status: 400 }
      );
    }
    if (coupon.max_uses > 0 && coupon.used >= coupon.max_uses) {
      return NextResponse.json({ error: "Cupom esgotado" }, { status: 400 });
    }
    if (coupon.valid_until && coupon.valid_until < todayInSaoPaulo()) {
      return NextResponse.json({ error: "Cupom expirado" }, { status: 400 });
    }
    if (subtotal < Number(coupon.min_order)) {
      return NextResponse.json(
        { error: `Pedido mínimo de R$ ${Number(coupon.min_order).toFixed(2)}` },
        { status: 400 }
      );
    }

    const { data: couponPdvs, error: couponPdvsError } = await supabase
      .from("coupons_pdvs")
      .select("pdv_id")
      .eq("coupon_id", coupon.id);
    if (couponPdvsError) {
      return internalErrorResponse(
        "customer-order-coupon-scope",
        couponPdvsError,
        "Não foi possível validar o cupom"
      );
    }
    if ((couponPdvs ?? []).length > 0 && !couponPdvs?.some((item) => item.pdv_id === pdv.id)) {
      return NextResponse.json(
        { error: "Cupom não válido para este PDV" },
        { status: 400 }
      );
    }

    couponId = coupon.id;
    discount =
      coupon.type === "percent"
        ? (subtotal * Number(coupon.value)) / 100
        : Number(coupon.value);
  }

  const total = Math.max(0, subtotal - discount);
  if (total <= 0) return NextResponse.json({ error: "Total inválido" }, { status: 400 });

  // Cliente completo do banco (Asaas holderInfo vem do cadastro)
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name, email, phone, cpf, postal_code, address_number, address_complement")
    .eq("id", session.customer_id)
    .maybeSingle();
  if (customerError) {
    return internalErrorResponse(
      "customer-order-customer",
      customerError,
      "Não foi possível consultar o cadastro"
    );
  }
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  if (body.method === "card") {
    if (!customerReadyForCard(customer)) {
      return NextResponse.json(
        {
          error:
            "Complete e-mail, telefone, CEP e número do endereço no cadastro antes de pagar com cartão",
        },
        { status: 400 }
      );
    }
  }

  const customerEmail = customer.email ?? null;

  let asaasPaymentId: string | null = null;
  let pixPayload: string | null = null;
  let pixQrCode: string | null = null;
  let cardInstantlyConfirmed = false;

  if (!counterCheckout) {
    try {
      const asaasCustomer = await findOrCreateCustomer({
        name: customer.name,
        cpfCnpj: customer.cpf,
        email: customerEmail,
        phone: customer.phone,
        externalReference: customer.id,
      });

      if (body.method === "pix") {
        const payment = await createPixPayment({
          customerId: asaasCustomer.id,
          value: total,
          description: `maFood · ${pdv.name}`,
          externalReference: customer.id,
          dueDate: tomorrow(),
        });
        const qr = await getPixQr(payment.id);
        asaasPaymentId = payment.id;
        pixPayload = qr.payload;
        pixQrCode = qr.encodedImage || null;
      } else {
        if (!customerEmail) {
          return NextResponse.json({ error: "E-mail é obrigatório para cartão" }, { status: 400 });
        }
        const payment = await createCardPayment({
          customerId: asaasCustomer.id,
          value: total,
          description: `maFood · ${pdv.name}`,
          externalReference: customer.id,
          dueDate: tomorrow(),
          remoteIp: getClientIp(req),
          creditCard: body.card!,
          creditCardHolderInfo: {
            name: customer.name,
            email: customerEmail,
            cpfCnpj: customer.cpf,
            postalCode: customer.postal_code!,
            addressNumber: customer.address_number!,
            addressComplement: customer.address_complement ?? undefined,
            phone: customer.phone ?? undefined,
          },
        });
        asaasPaymentId = payment.id;
        cardInstantlyConfirmed = payment.status === "CONFIRMED" || payment.status === "RECEIVED";
      }
    } catch (err) {
      return upstreamErrorResponse(
        "customer-order-payment",
        err,
        "Não foi possível processar o pagamento. Confira os dados e tente novamente."
      );
    }
  }

  // counter → pending (aguarda confirmação na maquininha); cartão confirmado → paid; senão pending
  const orderStatus = cardInstantlyConfirmed ? "paid" : "pending";
  const paidAt = cardInstantlyConfirmed ? new Date().toISOString() : null;
  const { data: order, error: eOrder } = await supabase
    .from("orders")
    .insert({
      venue_id: pdv.venue_id,
      pdv_id: pdv.id,
      customer_id: session.customer_id,
      customer_name: session.name,
      customer_cpf: session.cpf,
      total,
      method: body.method,
      status: orderStatus,
      paid_at: paidAt,
      notes: body.notes ?? null,
      coupon_id: couponId,
      asaas_payment_id: asaasPaymentId,
      pix_payload: pixPayload,
      pix_qr_code: pixQrCode,
    })
    .select("id, number")
    .single();

  if (eOrder || !order) {
    return internalErrorResponse(
      "customer-order-create",
      eOrder ?? new Error("order insert returned no row"),
      "Não foi possível criar o pedido"
    );
  }

  const itemsToInsert = body.items.map((it) => {
    const p = byId.get(it.product_id)!;
    const line = resolveLine(it) as { name: string; unit_price: number };
    return {
      order_id: order.id,
      product_id: p.id,
      name: line.name,
      qty: it.qty,
      unit_price: line.unit_price,
      notes: it.notes ?? null,
    };
  });

  const { error: eItems } = await supabase.from("order_items").insert(itemsToInsert);
  if (eItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    return internalErrorResponse(
      "customer-order-items",
      eItems,
      "Não foi possível salvar os itens do pedido"
    );
  }

  if (orderStatus === "paid") {
    await decrementStockForOrder(supabase, order.id);
  }

  if (couponId) {
    const { data: cur } = await supabase
      .from("coupons")
      .select("used")
      .eq("id", couponId)
      .maybeSingle();
    if (cur) {
      await supabase.from("coupons").update({ used: cur.used + 1 }).eq("id", couponId);
    }
  }

  return NextResponse.json({
    ok: true,
    simulated: !asaasEnabled,
    order_id: order.id,
    order_number: order.number,
    total,
    discount,
    method: body.method,
    status: orderStatus,
    pix_payload: pixPayload,
    pix_qr_code: pixQrCode,
  });
}
