/*
  Remoção (DELETE) de pedido pelo cliente — apaga da base de dados.
  Permitido SOMENTE para pedidos não pagos (status 'pending' ou 'cancelled').
  Pedidos pagos/em preparo/entregues NÃO podem ser apagados pelo cliente
  (afetariam carteira do PDV e contabilidade).
  order_items é removido automaticamente (ON DELETE CASCADE).
*/
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { cancelPayment } from "@/lib/asaas";
import { internalErrorResponse, upstreamErrorResponse } from "@/lib/server-errors";

interface Params {
  params: { id: string };
}

const DELETABLE = new Set(["pending", "cancelled"]);

export async function GET(req: Request, { params }: Params) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const supabase = createAdminClient();
  if (new URL(req.url).searchParams.get("view") === "status") {
    const { data: statusOrder, error: statusError } = await supabase
      .from("orders")
      .select("customer_id, status")
      .eq("id", params.id)
      .maybeSingle();
    if (statusError) {
      return internalErrorResponse(
        "customer-order-status",
        statusError,
        "Não foi possível consultar o pedido"
      );
    }
    if (!statusOrder || statusOrder.customer_id !== session.customer_id) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ status: statusOrder.status });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, number, customer_id, customer_name, total, status, method, created_at, paid_at, ready_at, pdv_id, pix_payload, pix_qr_code, created_by"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) {
    return internalErrorResponse(
      "customer-order-status",
      error,
      "Não foi possível consultar o pedido"
    );
  }
  if (!order || order.customer_id !== session.customer_id) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const [{ data: items, error: itemsError }, { data: pdv, error: pdvError }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("id, name, qty, delivered_qty, unit_price, notes")
        .eq("order_id", order.id),
      supabase.from("pdvs").select("name").eq("id", order.pdv_id).maybeSingle(),
    ]);
  if (itemsError || pdvError) {
    return internalErrorResponse(
      "customer-order-details",
      itemsError ?? pdvError,
      "Não foi possível consultar o pedido"
    );
  }

  return NextResponse.json({
    status: order.status,
    order: {
      id: order.id,
      number: order.number,
      pdv_name: pdv?.name ?? "PDV",
      customer_name: order.customer_name,
      total: Number(order.total),
      status: order.status,
      method: order.method,
      created_at: order.created_at,
      paid_at: order.paid_at,
      ready_at: order.ready_at,
      pix_payload: order.pix_payload ?? null,
      pix_qr_code: order.pix_qr_code ?? null,
      created_by: order.created_by ?? "customer",
      items: (items ?? []).map((item) => ({
        ...item,
        unit_price: Number(item.unit_price),
      })),
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, status, asaas_payment_id")
    .eq("id", params.id)
    .maybeSingle();
  if (orderError) {
    return internalErrorResponse(
      "customer-order-delete-read",
      orderError,
      "Não foi possível consultar o pedido"
    );
  }

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
    const cancelled = await cancelPayment(order.asaas_payment_id);
    if (!cancelled) {
      return upstreamErrorResponse(
        "customer-order-delete-payment",
        new Error("provider cancellation failed"),
        "Não foi possível cancelar a cobrança. Tente novamente."
      );
    }
  }

  const { error } = await supabase.from("orders").delete().eq("id", order.id);
  if (error) {
    return internalErrorResponse(
      "customer-order-delete",
      error,
      "Não foi possível remover o pedido"
    );
  }

  return NextResponse.json({ ok: true, deleted: true });
}
