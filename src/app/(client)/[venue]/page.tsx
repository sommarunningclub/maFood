import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { CustomerHeader } from "@/components/customer/customer-header";

export const dynamic = "force-dynamic";

export default async function MarketplacePage({ params }: { params: { venue: string } }) {
  const supabase = createAdminClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id, slug, name, description, is_active")
    .eq("slug", params.venue)
    .maybeSingle();
  if (!venue) notFound();

  const [pdvsRes, productsRes] = await Promise.all([
    supabase
      .from("pdvs")
      .select("id, slug, name, category, logo_url, prep_time_min, is_open, sort_order, instagram_handle")
      .eq("venue_id", venue.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("pdv_id, status")
      .eq("status", "active"),
  ]);

  const pdvs = pdvsRes.data ?? [];
  const products = productsRes.data ?? [];
  const countByPdv = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.pdv_id] = (acc[p.pdv_id] ?? 0) + 1;
    return acc;
  }, {});

  const session = await getCustomerSession();

  return (
    <div className="pb-10 somma-grain">
      <CustomerHeader session={session} venue={params.venue} />

      {/* Hero */}
      <header className="relative px-5 pt-6 pb-7 bg-gradient-to-b from-somma-orange/15 to-transparent">
        <p className="num text-[11px] text-somma-orange tracking-[0.25em] mb-2">
          18 JUL 2026 · COPMDF · BRASÍLIA
        </p>
        <h1 className="text-4xl leading-[0.95] text-white font-display uppercase">
          {venue.name}
        </h1>
        {venue.description && (
          <p className="text-somma-muted text-sm mt-2">{venue.description}</p>
        )}
      </header>

      {/* Lista de PDVs */}
      <section className="px-5 space-y-3">
        <h2 className="text-lg text-white font-display uppercase tracking-wide">
          Escolha um ponto
        </h2>
        {pdvs.map((pdv) => {
          const available = countByPdv[pdv.id] ?? 0;
          return (
            <Link
              key={pdv.id}
              href={pdv.is_open ? `/${params.venue}/${pdv.slug}` : "#"}
              aria-disabled={!pdv.is_open}
              className={`block rounded-client border border-somma-border bg-somma-surface p-4 transition-all ${
                pdv.is_open
                  ? "active:scale-[0.98] hover:border-somma-orange/50"
                  : "opacity-50 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">{pdv.logo_url || "🍽"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-display uppercase tracking-wide text-lg">
                      {pdv.name}
                    </h3>
                    {!pdv.is_open && (
                      <span className="num text-[10px] text-somma-red bg-somma-red/10 px-1.5 py-0.5">
                        FECHADO
                      </span>
                    )}
                  </div>
                  <p className="text-somma-muted text-xs">{pdv.category}</p>
                  <div className="flex items-center gap-3 mt-1.5 num text-[11px] text-somma-muted flex-wrap">
                    <span>⏱ {pdv.prep_time_min} min</span>
                    <span>· {available} {available === 1 ? "item" : "itens"}</span>
                    {pdv.instagram_handle && (
                      <a
                        href={`https://instagram.com/${pdv.instagram_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-somma-orange hover:underline"
                      >
                        @{pdv.instagram_handle}
                      </a>
                    )}
                  </div>
                </div>
                <span className="text-somma-orange text-xl">→</span>
              </div>
            </Link>
          );
        })}
        {pdvs.length === 0 && (
          <p className="text-somma-muted text-sm text-center py-6">
            Nenhum PDV cadastrado ainda neste evento.
          </p>
        )}
      </section>

      <footer className="px-5 mt-8 num text-[10px] text-somma-muted text-center">
        <Link href={`/${params.venue}/history`} className="underline">
          Ver meus pedidos
        </Link>
      </footer>
    </div>
  );
}
