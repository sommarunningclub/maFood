import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { MarketplaceView, type PdvCardData } from "@/components/customer/marketplace-view";

export const dynamic = "force-dynamic";

export default async function MarketplacePage({ params }: { params: { venue: string } }) {
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id, slug, name, description, is_active")
    .eq("slug", params.venue)
    .maybeSingle();
  if (!venue) notFound();

  const { data: pdvsData } = await supabase
    .from("pdvs")
    .select(
      "id, slug, name, category, logo_url, is_open, sort_order, prep_time_min, instagram_handle"
    )
    .eq("venue_id", venue.id)
    .order("sort_order", { ascending: true });

  const pdvs = pdvsData ?? [];

  // Stats por PDV: contagem de produtos ativos + faixa de preço
  const ids = pdvs.map((p) => p.id);
  const { data: products } = ids.length
    ? await supabase
        .from("products")
        .select("pdv_id, price, status")
        .in("pdv_id", ids)
        .eq("status", "active")
    : { data: [] as { pdv_id: string; price: number; status: string }[] };

  const statsByPdv = new Map<string, { count: number; min: number; max: number }>();
  for (const p of products ?? []) {
    const cur = statsByPdv.get(p.pdv_id) ?? { count: 0, min: Infinity, max: 0 };
    cur.count += 1;
    cur.min = Math.min(cur.min, Number(p.price));
    cur.max = Math.max(cur.max, Number(p.price));
    statsByPdv.set(p.pdv_id, cur);
  }

  const cards: PdvCardData[] = pdvs.map((pdv) => {
    const s = statsByPdv.get(pdv.id);
    return {
      id: pdv.id,
      slug: pdv.slug,
      name: pdv.name,
      category: pdv.category,
      logo_url: pdv.logo_url,
      is_open: pdv.is_open,
      prep_time_min: pdv.prep_time_min,
      instagram_handle: pdv.instagram_handle,
      product_count: s?.count ?? 0,
      price_min: s && Number.isFinite(s.min) ? s.min : null,
      price_max: s?.max ?? null,
    };
  });

  return (
    <MarketplaceView
      venueSlug={params.venue}
      venueName={venue.name}
      venueDescription={venue.description}
      pdvs={cards}
    />
  );
}
