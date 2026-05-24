import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { sendPaymentLinkEmail } from "@/lib/email/send-payment-link";
import { brl } from "@/lib/utils";

const Body = z.object({
  channel: z.enum(["email", "whatsapp"]),
  email: z.string().email().optional(),
  // whatsapp é gerado client-side via wa.me — endpoint só registra log se for o canal
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : "Dados invalidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, number, customer_name, total, method, status, pdv_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.pdv_id !== session.pdv_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (order.method !== "card") {
    return NextResponse.json({ error: "Link de pagamento só vale pra pedidos com cartão" }, { status: 400 });
  }

  const { data: pdv } = await supabase
    .from("pdvs")
    .select("name")
    .eq("id", order.pdv_id)
    .maybeSingle();

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const payUrl = `${origin}/pay/${order.id}`;

  if (body.channel === "email") {
    if (!body.email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });
    const result = await sendPaymentLinkEmail({
      to: body.email,
      customerName: order.customer_name,
      pdvName: pdv?.name ?? "PDV",
      orderNumber: order.number,
      totalBrl: brl(Number(order.total)),
      payUrl,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, sent_to: body.email });
  }

  // WhatsApp: só confirma o link; o disparo é via wa.me no client
  return NextResponse.json({ ok: true, pay_url: payUrl });
}
