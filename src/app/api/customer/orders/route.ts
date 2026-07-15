/*
  Criação de pedido pelo cliente (PWA). Sempre integra com Asaas:
  - Pix: createPixPayment + getPixQr → devolve payload + QR base64 (frente exibe)
  - Cartão de crédito (checkout transparente): createCardPayment + holderInfo
    + remoteIp. Se Asaas retorna CONFIRMED/RECEIVED na hora, marca order como
    paid imediatamente; caso contrário deixa pending até o webhook confirmar.

  Asaas falhou (erro de validação ou rejeição): NÃO cria pedido — devolve 4xx
  com a mensagem que o Asaas retornou (`errors[0].description`).
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { pdvSellsOnline } from "@/lib/pdv";
import { effectivePrice } from "@/lib/pricing";
import {
  asaasEnabled,
  createCardPayment,
  createPixPayment,
  findOrCreateCustomer,
  getPixQr,
} from "@/lib/asaas";
import { validateStock, decrementStockForOrder } from "@/lib/stock";

const CardSchema = z.object({
  holderName: z.string().min(2).max(120),
  number: z.string().min(13).max(25),
  expiryMonth: z.string().regex(/^\d{1,2}$/),
  expiryYear: z.string().regex(/^\d{2}|\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
});

const HolderInfoSchema = z.object({
  email: z.string().email(),
  postalCode: z.string().min(8).max(9),
  addressNumber: z.string().min(1).max(20),
  addressComplement: z.string().max(60).optional().nullable(),
  phone: z.string().optional().nullable(),
});

const Body = z.object({
  pdv_id: z.string().uuid(),
  method: z.enum(["pix", "card"]),
  notes: z.string().max(500).optional().nullable(),
  coupon_code: z.string().max(60).optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(99),
        notes: z.string().max(200).optional().nullable(),
      })
    )
    .min(1),
  card: CardSchema.optional(),
  holder_info: HolderInfoSchema.optional(),
});

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

  if (body.method === "card" && (!body.card || !body.holder_info)) {
    return NextResponse.json(
      { error: "Cartão e dados do titular são obrigatórios para pagamento com cartão" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: pdv, error: ePdv } = await supabase
    .from("pdvs")
    .select("id, venue_id, name, is_open, category")
    .eq("id", body.pdv_id)
    .maybeSingle();
  if (ePdv || !pdv) return NextResponse.json({ error: "PDV invalido" }, { status: 400 });
  if (!pdv.is_open) return NextResponse.json({ error: "PDV fechado" }, { status: 400 });
  if (!pdvSellsOnline(pdv))
    return NextResponse.json(
      { error: "Este PDV não aceita pagamento pelo app" },
      { status: 422 }
    );

  const productIds = body.items.map((i) => i.product_id);
  const { data: products, error: ePr } = await supabase
    .from("products")
    .select("id, pdv_id, name, price, sale_price, status")
    .in("id", productIds);
  if (ePr) return NextResponse.json({ error: ePr.message }, { status: 500 });

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Produto invalido" }, { status: 400 });
    if (p.pdv_id !== pdv.id)
      return NextResponse.json({ error: "Produto nao pertence ao PDV" }, { status: 400 });
    if (p.status !== "active")
      return NextResponse.json({ error: `Produto indisponivel: ${p.name}` }, { status: 400 });
  }

  const stockError = await validateStock(supabase, body.items);
  if (stockError) return NextResponse.json({ error: stockError }, { status: 400 });

  // Subtotal + cupom
  let couponId: string | null = null;
  let discount = 0;
  const subtotal = body.items.reduce((s, it) => {
    const p = byId.get(it.product_id)!;
    return s + effectivePrice(p) * it.qty;
  }, 0);

  if (body.coupon_code) {
    const code = body.coupon_code.trim().toUpperCase();
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, type, value, min_order, max_uses, used, is_active, valid_until")
      .eq("code", code)
      .maybeSingle();
    if (coupon && coupon.is_active && (coupon.max_uses === 0 || coupon.used < coupon.max_uses)) {
      const exp = coupon.valid_until ? new Date(coupon.valid_until) : null;
      const ok = !exp || exp >= new Date();
      const min = Number(coupon.min_order);
      if (ok && subtotal >= min) {
        couponId = coupon.id;
        discount =
          coupon.type === "percent"
            ? (subtotal * Number(coupon.value)) / 100
            : Number(coupon.value);
      }
    }
  }

  const total = Math.max(0, subtotal - discount);
  if (total <= 0) return NextResponse.json({ error: "Total inválido" }, { status: 400 });

  // Cliente completo do banco (precisamos do email pra holderInfo)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone, cpf")
    .eq("id", session.customer_id)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Email pra Asaas — pega do cadastro; se cartão, usa o do form (sobrescreve)
  const customerEmail =
    body.method === "card" && body.holder_info?.email
      ? body.holder_info.email
      : customer.email ?? null;

  // Asaas: cria/recupera cliente, cria cobrança
  let asaasPaymentId: string | null = null;
  let pixPayload: string | null = null;
  let pixQrCode: string | null = null;
  let cardInstantlyConfirmed = false;

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
      // Asaas exige email no holderInfo — garantido pelo schema do form
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
          postalCode: body.holder_info!.postalCode,
          addressNumber: body.holder_info!.addressNumber,
          addressComplement: body.holder_info!.addressComplement ?? undefined,
          phone: body.holder_info!.phone ?? customer.phone ?? undefined,
        },
      });
      asaasPaymentId = payment.id;
      cardInstantlyConfirmed = payment.status === "CONFIRMED" || payment.status === "RECEIVED";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Cria pedido (pending por padrão; paid se cartão já confirmou)
  const orderStatus = cardInstantlyConfirmed ? "paid" : "pending";
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
      paid_at: cardInstantlyConfirmed ? new Date().toISOString() : null,
      notes: body.notes ?? null,
      coupon_id: couponId,
      asaas_payment_id: asaasPaymentId,
      pix_payload: pixPayload,
      pix_qr_code: pixQrCode,
    })
    .select("id, number")
    .single();

  if (eOrder || !order) {
    return NextResponse.json({ error: eOrder?.message ?? "Erro ao criar pedido" }, { status: 500 });
  }

  const itemsToInsert = body.items.map((it) => {
    const p = byId.get(it.product_id)!;
    return {
      order_id: order.id,
      product_id: p.id,
      name: p.name,
      qty: it.qty,
      unit_price: effectivePrice(p),
      notes: it.notes ?? null,
    };
  });

  const { error: eItems } = await supabase.from("order_items").insert(itemsToInsert);
  if (eItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: eItems.message }, { status: 500 });
  }

  if (cardInstantlyConfirmed) {
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
