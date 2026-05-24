/*
  Endpoint público de pagamento por LINK (cartão).
  GET  → devolve resumo da cobrança pra a página /pay/[id] exibir
  POST → processa cartão via Asaas (transparente). Reusa lib/asaas.

  Segurança: order.id é UUID v4 (não-enumerável). Só pedidos com
  method=card e status=pending podem ser pagos por essa rota.
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  asaasEnabled,
  createCardPayment,
  findOrCreateCustomer,
} from "@/lib/asaas";

interface Params { params: { id: string } }

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

export async function GET(_req: Request, { params }: Params) {
  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, customer_name, total, method, status, notes, pdv_id, customer_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const [{ data: items }, { data: pdv }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, name, qty, unit_price")
      .eq("order_id", params.id),
    supabase.from("pdvs").select("name, venue_id").eq("id", order.pdv_id).maybeSingle(),
  ]);

  return NextResponse.json({
    order: {
      id: order.id,
      number: order.number,
      customer_name: order.customer_name,
      total: Number(order.total),
      method: order.method,
      status: order.status,
      notes: order.notes,
      pdv_name: pdv?.name ?? "PDV",
      items: (items ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        unit_price: Number(i.unit_price),
      })),
    },
  });
}

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

const PostBody = z.object({
  card: CardSchema,
  holder_info: HolderInfoSchema,
});

export async function POST(req: Request, { params }: Params) {
  let body: z.infer<typeof PostBody>;
  try { body = PostBody.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, customer_name, customer_cpf, total, method, status, pdv_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.method !== "card") return NextResponse.json({ error: "Link inválido" }, { status: 400 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Este pedido não está mais aguardando pagamento" }, { status: 409 });
  }

  // Customer do banco (pra ter email/phone se faltarem no holderInfo)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone, cpf")
    .eq("id", order.customer_id)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Cliente do pedido não encontrado" }, { status: 500 });

  const { data: pdv } = await supabase
    .from("pdvs")
    .select("name")
    .eq("id", order.pdv_id)
    .maybeSingle();

  let asaasPaymentId: string | null = null;
  let confirmed = false;
  try {
    const asaasCustomer = await findOrCreateCustomer({
      name: customer.name,
      cpfCnpj: customer.cpf,
      email: body.holder_info.email,
      phone: body.holder_info.phone ?? customer.phone,
      externalReference: customer.id,
    });
    const payment = await createCardPayment({
      customerId: asaasCustomer.id,
      value: Number(order.total),
      description: `maFood · ${pdv?.name ?? "PDV"} · pedido #${order.id.slice(0, 8)}`,
      externalReference: order.id,
      dueDate: tomorrow(),
      remoteIp: getClientIp(req),
      creditCard: body.card,
      creditCardHolderInfo: {
        name: customer.name,
        email: body.holder_info.email,
        cpfCnpj: customer.cpf,
        postalCode: body.holder_info.postalCode,
        addressNumber: body.holder_info.addressNumber,
        addressComplement: body.holder_info.addressComplement ?? undefined,
        phone: body.holder_info.phone ?? customer.phone ?? undefined,
      },
    });
    asaasPaymentId = payment.id;
    confirmed = payment.status === "CONFIRMED" || payment.status === "RECEIVED";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar pagamento" },
      { status: 502 }
    );
  }

  const patch: Record<string, unknown> = { asaas_payment_id: asaasPaymentId };
  if (confirmed) {
    patch.status = "paid";
    patch.paid_at = new Date().toISOString();
  }
  await supabase.from("orders").update(patch).eq("id", order.id);

  return NextResponse.json({
    ok: true,
    simulated: !asaasEnabled,
    status: confirmed ? "paid" : "pending",
  });
}
