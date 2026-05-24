import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PayLinkView } from "@/components/pay/pay-link-view";

export const dynamic = "force-dynamic";

interface OrderSummary {
  id: string;
  number: number;
  customer_name: string;
  total: number;
  method: "pix" | "card";
  status: string;
  notes: string | null;
  pdv_name: string;
  items: { id: string; name: string; qty: number; unit_price: number }[];
}

async function fetchOrder(id: string): Promise<OrderSummary | null> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const r = await fetch(`${proto}://${host}/api/pay/${id}`, { cache: "no-store" });
  if (!r.ok) return null;
  const data = await r.json();
  return data.order;
}

export default async function PayPage({ params }: { params: { id: string } }) {
  const order = await fetchOrder(params.id);
  if (!order) notFound();
  return <PayLinkView orderInitial={order} orderId={params.id} />;
}
