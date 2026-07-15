/*
  Cancelamento de pedido pelo cliente.
  Permitido SOMENTE quando o pedido ainda está 'pending' (sem pagamento
  confirmado). Pedidos pagos/em preparo não podem ser cancelados por aqui.
  Cancela também a cobrança no Asaas (best-effort).
*/
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { cancelPayment } from "@/lib/asaas";

interface Params {
  params: { id: string };
}

export async function POST(_req: Request, { params }: Params) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, status, asaas_payment_id, coupon_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.customer_id !== session.customer_id) {
    return NextResponse.json({ error: "Pedido não pertence a você" }, { status: 403 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Só é possível cancelar pedidos que ainda não foram pagos" },
      { status: 409 }
    );
  }

  // Cancela a cobrança no Asaas (best-effort — não bloqueia o cancelamento local)
  if (order.asaas_payment_id) {
    await cancelPayment(order.asaas_payment_id);
  }

  const { data: cancelled, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", order.id)
    .eq("status", "pending") // guard contra corrida com webhook de confirmação
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Só restaura o cupom se o cancelamento realmente ocorreu (não houve corrida com
  // o webhook de confirmação) e o pedido usava cupom.
  if (cancelled && order.coupon_id) {
    const { data: cur } = await supabase
      .from("coupons")
      .select("used")
      .eq("id", order.coupon_id)
      .maybeSingle();
    if (cur && cur.used > 0) {
      await supabase.from("coupons").update({ used: cur.used - 1 }).eq("id", order.coupon_id);
    }
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
