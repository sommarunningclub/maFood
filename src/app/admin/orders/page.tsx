import { PageHeader } from "@/components/admin/page-header";
import {
  OrdersView,
  type AdminOrderRow,
  type AdminOrderPdv,
} from "@/components/admin/orders-view";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

type OrderRecord = {
  id: string;
  number: number;
  pdv_id: string;
  customer_name: string | null;
  method: string | null;
  total: number | null;
  status: OrderStatus;
  created_at: string;
  pdvs: { name: string | null } | null;
  order_items: { qty: number | null }[] | null;
};

export default async function OrdersPage() {
  const supabase = createAdminClient();

  const [{ data: orders }, { data: pdvs }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, pdv_id, customer_name, method, total, status, created_at, pdvs(name), order_items(qty)"
      )
      .order("created_at", { ascending: false })
      .returns<OrderRecord[]>(),
    supabase.from("pdvs").select("id, name").order("sort_order"),
  ]);

  const rows: AdminOrderRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    pdv_id: o.pdv_id,
    pdv_name: o.pdvs?.name ?? "—",
    customer_name: o.customer_name ?? "—",
    items: (o.order_items ?? []).reduce((s, i) => s + (i.qty ?? 0), 0),
    method: o.method ?? "",
    total: Number(o.total ?? 0),
    status: o.status,
    created_at: o.created_at,
  }));

  const pdvOptions: AdminOrderPdv[] = (pdvs ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) ?? "—",
  }));

  return (
    <>
      <PageHeader title="Pedidos" subtitle={`${rows.length} registros`} />
      <OrdersView orders={rows} pdvs={pdvOptions} />
    </>
  );
}
