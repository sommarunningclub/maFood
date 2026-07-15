import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePrice } from "@/lib/pricing";
import { MenuView } from "@/components/customer/menu-view";

export const dynamic = "force-dynamic";

export default async function PdvMenuPage({
  params,
}: {
  params: { venue: string; pdv: string };
}) {
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", params.venue)
    .maybeSingle();
  if (!venue) notFound();

  const { data: pdv } = await supabase
    .from("pdvs")
    .select("id, slug, venue_id, name, category, logo_url, prep_time_min, is_open, is_visible, sells_online, instagram_handle, commission_pct, gateway_pct, sort_order, wallet_balance")
    .eq("slug", params.pdv)
    .eq("venue_id", venue.id)
    .maybeSingle();
  // PDV oculto do cardápio: link direto também fica inacessível.
  if (!pdv || !pdv.is_visible) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("id, pdv_id, category, category_id, name, description, image_url, price, sale_price, status")
    .eq("pdv_id", pdv.id)
    .in("status", ["active", "out_of_stock"])
    .order("created_at", { ascending: true });

  return (
    <MenuView
      venue={params.venue}
      pdv={{
        ...pdv,
        commission_pct: Number(pdv.commission_pct),
        gateway_pct: Number(pdv.gateway_pct),
        wallet_balance: Number(pdv.wallet_balance),
      }}
      products={(products ?? []).map((p) => ({
        id: p.id,
        pdv_id: p.pdv_id,
        category: p.category ?? "",
        name: p.name,
        description: p.description ?? "",
        image_url: p.image_url ?? "",
        price: effectivePrice(p),
        status: p.status,
      }))}
    />
  );
}
