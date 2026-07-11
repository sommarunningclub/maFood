/*
  Remoção (DELETE) de pedido pelo cliente — apaga da base de dados.
  Permitido SOMENTE para pedidos não pagos (status 'pending' ou 'cancelled').
  Pedidos pagos/em preparo/entregues NÃO podem ser apagados pelo cliente
  (afetariam carteira do PDV e contabilidade).
  order_items é removido automaticamente (ON DELETE CASCADE).
*/
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { cancelPayment } from "@/lib/asaas";

interface Params {
  params: { id: string };
}

const DELETABLE = new Set(["pending", "cancelled"]);

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, status, asaas_payment_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (order.customer_id !== session.customer_id) {
    return NextResponse.json({ error: "Pedido não pertence a você" }, { status: 403 });
  }
  if (!DELETABLE.has(order.status)) {
    return NextResponse.json(
      { error: "Só é possível remover pedidos que ainda não foram pagos" },
      { status: 409 }
    );
  }

  // Se ainda pendente com cobrança ativa, cancela no Asaas antes de apagar
  if (order.status === "pending" && order.asaas_payment_id) {
    await cancelPayment(order.asaas_payment_id);
  }

  const { error } = await supabase.from("orders").delete().eq("id", order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: true });
}
