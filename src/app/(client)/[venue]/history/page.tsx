import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  OrdersHistoryView,
  type OrderRow,
} from "@/components/customer/orders-history-view";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: { venue: string } }) {
  const session = await getCustomerSession();
  if (!session) redirect(`/${params.venue}/login?next=/${params.venue}/history`);

  const supabase = createAdminClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, total, method, status, created_at, pdv_id, created_by")
    .eq("customer_id", session.customer_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const pdvIds = Array.from(new Set((orders ?? []).map((o) => o.pdv_id)));
  const { data: pdvs } = await supabase
    .from("pdvs")
    .select("id, name, logo_url")
    .in("id", pdvIds.length ? pdvIds : ["00000000-0000-0000-0000-000000000000"]);
  const pdvById = new Map((pdvs ?? []).map((p) => [p.id, p]));

  const rows: OrderRow[] = (orders ?? []).map((o) => {
    const pdv = pdvById.get(o.pdv_id);
    return {
      id: o.id,
      number: o.number,
      total: Number(o.total),
      method: o.method,
      status: o.status as OrderRow["status"],
      created_at: o.created_at,
      created_by: (o as { created_by?: string }).created_by ?? "customer",
      pdv_name: pdv?.name ?? "PDV",
      pdv_logo: pdv?.logo_url ?? null,
    };
  });

  return <OrdersHistoryView venue={params.venue} orders={rows} />;
}
