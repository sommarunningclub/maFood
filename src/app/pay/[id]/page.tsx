import { notFound } from "next/navigation";
import { z } from "zod";
import { PayLinkView } from "@/components/pay/pay-link-view";
import { logServerError } from "@/lib/server-errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface OrderSummary {
  id: string;
  number: number;
  total: number;
  method: "pix" | "card";
  status: string;
  pdv_name: string;
  items: { id: string; name: string; qty: number; unit_price: number }[];
}

async function fetchOrder(id: string): Promise<OrderSummary | null> {
  if (!z.string().uuid().safeParse(id).success) return null;

  try {
    const supabase = createAdminClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, number, total, method, status, pdv_id")
      .eq("id", id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.method !== "card") return null;

    const [
      { data: items, error: itemsError },
      { data: pdv, error: pdvError },
    ] = await Promise.all([
      supabase
        .from("order_items")
        .select("id, name, qty, unit_price")
        .eq("order_id", id),
      supabase.from("pdvs").select("name").eq("id", order.pdv_id).maybeSingle(),
    ]);
    if (itemsError || pdvError) throw itemsError ?? pdvError;

    return {
      id: order.id,
      number: order.number,
      total: Number(order.total),
      method: order.method,
      status: order.status,
      pdv_name: pdv?.name ?? "PDV",
      items: (items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        unit_price: Number(item.unit_price),
      })),
    };
  } catch (error) {
    logServerError("pay-link-page", error);
    return null;
  }
}

export default async function PayPage({ params }: { params: { id: string } }) {
  const order = await fetchOrder(params.id);
  if (!order) notFound();
  return <PayLinkView orderInitial={order} orderId={params.id} />;
}
