/*
  Endpoint POS-like: operador do PDV registra um pedido no nome de um cliente
  (busca pelo CPF). Gera cobrança Pix via Asaas, salva pedido com status=pending.
  Quando o pagamento for confirmado (webhook /api/webhooks/asaas), o pedido
  transita pra "paid" e cai na fila de preparo do mesmo PDV.
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import {
  asaasEnabled,
  createPixPayment,
  findOrCreateCustomer,
  getPixQr,
} from "@/lib/asaas";

const Body = z.object({
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  // Permite criar cliente novo direto se não existir
  customer: z
    .object({
      name: z.string().min(2).max(120),
      email: z.string().email().optional().nullable(),
      phone: z.string().regex(/^\d{10,11}$/).optional().nullable(),
    })
    .optional(),
  notes: z.string().max(500).optional().nullable(),
  method: z.enum(["pix", "card"]).default("pix"),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        qty: z.coerce.number().int().min(1).max(99),
        notes: z.string().max(200).optional().nullable(),
      })
    )
    .min(1),
});

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // PDV (sanidade + venue_id)
  const { data: pdv, error: ePdv } = await supabase
    .from("pdvs")
    .select("id, venue_id, name, is_open")
    .eq("id", session.pdv_id)
    .maybeSingle();
  if (ePdv || !pdv) return NextResponse.json({ error: "PDV inválido" }, { status: 400 });

  // Cliente — busca por CPF; cria se informado
  const { data: existing } = await supabase
    .from("customers")
    .select("id, name, email, phone, cpf")
    .eq("cpf", body.cpf)
    .maybeSingle();

  let customer = existing;
  if (!customer) {
    if (!body.customer?.name) {
      return NextResponse.json(
        { error: "Cliente não cadastrado. Envie 'customer.name' para criar." },
        { status: 404 }
      );
    }
    const { data: created, error: eCreate } = await supabase
      .from("customers")
      .insert({
        cpf: body.cpf,
        name: body.customer.name,
        email: body.customer.email ?? null,
        phone: body.customer.phone ?? null,
      })
      .select("id, name, email, phone, cpf")
      .single();
    if (eCreate || !created) {
      return NextResponse.json({ error: eCreate?.message ?? "Erro ao criar cliente" }, { status: 500 });
    }
    customer = created;
  }

  // Produtos (preço autoritativo, deve ser do mesmo PDV)
  const productIds = body.items.map((i) => i.product_id);
  const { data: products, error: ePr } = await supabase
    .from("products")
    .select("id, pdv_id, name, price, status")
    .in("id", productIds);
  if (ePr) return NextResponse.json({ error: ePr.message }, { status: 500 });

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  for (const it of body.items) {
    const p = byId.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
    if (p.pdv_id !== pdv.id)
      return NextResponse.json({ error: "Produto não pertence ao PDV" }, { status: 400 });
    if (p.status !== "active")
      return NextResponse.json({ error: `Indisponível: ${p.name}` }, { status: 400 });
  }

  const total = body.items.reduce((s, it) => {
    const p = byId.get(it.product_id)!;
    return s + Number(p.price) * it.qty;
  }, 0);

  if (total <= 0) return NextResponse.json({ error: "Total inválido" }, { status: 400 });

  // Pix → cria cobrança Asaas agora; Cartão (link) → cria order shell,
  // cobrança é gerada quando cliente abre /pay/[order_id] e digita cartão
  let asaasPaymentId: string | null = null;
  let pixPayload: string | null = null;
  let pixQrCode: string | null = null;
  let invoiceUrl: string | null = null;

  if (body.method === "pix") {
    try {
      const asaasCustomer = await findOrCreateCustomer({
        name: customer.name,
        cpfCnpj: customer.cpf,
        email: customer.email,
        phone: customer.phone,
        externalReference: customer.id,
      });
      const payment = await createPixPayment({
        customerId: asaasCustomer.id,
        value: total,
        description: `maFood · ${pdv.name} · pedido manual`,
        externalReference: customer.id,
        dueDate: tomorrow(),
      });
      const qr = await getPixQr(payment.id);
      asaasPaymentId = payment.id;
      pixPayload = qr.payload;
      pixQrCode = qr.encodedImage || null;
      invoiceUrl = payment.invoiceUrl ?? null;
    } catch (err) {
      return NextResponse.json(
        { error: `Falha no Asaas: ${err instanceof Error ? err.message : "erro"}` },
        { status: 502 }
      );
    }
  }

  // Cria pedido pending
  const { data: order, error: eOrder } = await supabase
    .from("orders")
    .insert({
      venue_id: pdv.venue_id,
      pdv_id: pdv.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_cpf: customer.cpf,
      total,
      method: body.method,
      status: "pending",
      created_by: "pdv",
      notes: body.notes ?? null,
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
      unit_price: Number(p.price),
      notes: it.notes ?? null,
    };
  });

  const { error: eItems } = await supabase.from("order_items").insert(itemsToInsert);
  if (eItems) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: eItems.message }, { status: 500 });
  }

  // Para cartão (link), monta a URL pública que o operador vai enviar
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const payUrl = body.method === "card" ? `${origin}/pay/${order.id}` : null;

  return NextResponse.json({
    ok: true,
    simulated: !asaasEnabled,
    order_id: order.id,
    order_number: order.number,
    total,
    method: body.method,
    pix_payload: pixPayload,
    pix_qr_code: pixQrCode,
    invoice_url: invoiceUrl,
    pay_url: payUrl,
    customer: {
      id: customer.id,
      name: customer.name,
      cpf: customer.cpf,
      email: customer.email,
      phone: customer.phone,
    },
  });
}
