import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPdvSession } from "@/lib/auth/session";
import { internalErrorResponse } from "@/lib/server-errors";
import { maskCpfForDisplay } from "@/lib/utils";

const REFUNDABLE_STATUSES = new Set([
  "paid",
  "preparing",
  "ready",
  "partial",
  "delivered",
]);
const RETRYABLE_REFUND_STATES = new Set([null, "failed", "cancelled"]);

export async function GET(req: Request) {
  const session = await getPdvSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "200", 10);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500)
      : 200;

  const supabase = createAdminClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, number, customer_name, customer_cpf, total, method, status, notes, created_at, paid_at, ready_at, asaas_payment_id, refund_status, refund_mode, refund_amount, refund_requested_at, refunded_at, refund_receipt_url"
    )
    .eq("pdv_id", session.pdv_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return internalErrorResponse("pdv-orders-list", error, "Não foi possível carregar os pedidos");
  }

  const ids = (orders ?? []).map((o) => o.id);
  let items: Array<{
    id: string;
    order_id: string;
    product_id: string | null;
    name: string;
    qty: number;
    delivered_qty: number;
    unit_price: number;
    notes: string | null;
  }> = [];
  if (ids.length) {
    const { data, error: e2 } = await supabase
      .from("order_items")
      .select("id, order_id, product_id, name, qty, delivered_qty, unit_price, notes")
      .in("order_id", ids);
    if (e2) {
      return internalErrorResponse(
        "pdv-orders-items",
        e2,
        "Não foi possível carregar os itens"
      );
    }
    items = data ?? [];
  }

  // Agrupa items por order
  const byOrder: Record<string, typeof items> = {};
  for (const it of items) (byOrder[it.order_id] ??= []).push(it);

  return NextResponse.json({
    orders: (orders ?? []).map((o) => {
      const {
        asaas_payment_id: asaasPaymentId,
        ...safeOrder
      } = o;
      const refundMode = asaasPaymentId ? "asaas" : "manual";
      const refundEligible =
        REFUNDABLE_STATUSES.has(o.status) &&
        RETRYABLE_REFUND_STATES.has(o.refund_status);

      return {
        ...safeOrder,
        customer_cpf: maskCpfForDisplay(o.customer_cpf),
        total: Number(o.total),
        refund_amount:
          o.refund_amount == null ? null : Number(o.refund_amount),
        refund_mode: o.refund_mode ?? refundMode,
        refund_eligible: refundEligible,
        items: (byOrder[o.id] ?? []).map((i) => ({
          ...i,
          unit_price: Number(i.unit_price),
        })),
      };
    }),
  });
}
