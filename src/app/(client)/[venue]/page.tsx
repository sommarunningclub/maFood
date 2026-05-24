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

  const { data: pdvsData } = await supabase
    .from("pdvs")
    .select("id, slug, name, category, logo_url, is_open, sort_order")
    .eq("venue_id", venue.id)
    .order("sort_order", { ascending: true });

  const pdvs = pdvsData ?? [];
  const session = await getCustomerSession();

  return (
    <div className="min-h-dvh-100 bg-somma-orange text-white pb-10 pb-safe">
      <CustomerHeader session={session} venue={params.venue} />

      {/* Hero — minimal, sem bloco/card */}
      <header className="px-5 pt-10 pb-12 text-center">
        <p className="num text-[11px] text-white/70 tracking-[0.3em] uppercase mb-3">
          18 jul 2026 · COPMDF · Brasília
        </p>
        <h1 className="text-fluid-3xl leading-[0.95] text-white font-display uppercase">
          {venue.name}
        </h1>
        {venue.description && (
          <p className="text-white/80 text-sm mt-3 max-w-xs mx-auto text-pretty">
            {venue.description}
          </p>
        )}
      </header>

      {/* Grid 2 cols — cards grandes, dark sobre laranja */}
      <section className="px-4 sm:px-6">
        <p className="num text-[10px] text-white/60 uppercase tracking-[0.25em] mb-4 text-center">
          escolha um ponto
        </p>

        {pdvs.length === 0 ? (
          <p className="text-white/70 text-sm text-center py-10">
            Nenhum PDV cadastrado ainda neste evento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
            {pdvs.map((pdv) => (
              <PdvCard
                key={pdv.id}
                venue={params.venue}
                slug={pdv.slug}
                name={pdv.name}
                category={pdv.category}
                logo={pdv.logo_url}
                isOpen={pdv.is_open}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center">
        <Link
          href={`/${params.venue}/history`}
          className="num text-[11px] text-white/80 underline underline-offset-4 inline-flex items-center min-h-touch px-3 focus-ring"
        >
          Ver meus pedidos
        </Link>
      </footer>
    </div>
  );
}

function PdvCard({
  venue,
  slug,
  name,
  category,
  logo,
  isOpen,
}: {
  venue: string;
  slug: string;
  name: string;
  category: string | null;
  logo: string | null;
  isOpen: boolean;
}) {
  const inner = (
    <>
      <div
        className="text-6xl sm:text-7xl mb-3 select-none"
        aria-hidden="true"
      >
        {logo || "🍽"}
      </div>
      <h3 className="text-white font-display uppercase tracking-wide text-base sm:text-lg leading-tight text-balance">
        {name}
      </h3>
      {category && (
        <p className="num text-[10px] text-somma-muted uppercase tracking-wider mt-1">
          {category}
        </p>
      )}
      {!isOpen && (
        <span className="absolute top-2 right-2 num text-[9px] text-somma-red bg-somma-red/15 px-1.5 py-0.5 rounded uppercase tracking-wider">
          Fechado
        </span>
      )}
    </>
  );

  const baseClass =
    "relative aspect-square flex flex-col items-center justify-center text-center px-3 py-4 rounded-2xl bg-somma-bg border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all focus-ring";

  if (!isOpen) {
    return (
      <div className={`${baseClass} opacity-40 pointer-events-none`}>{inner}</div>
    );
  }

  return (
    <Link
      href={`/${venue}/${slug}`}
      className={`${baseClass} active:scale-[0.97] hover:border-white/25 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]`}
    >
      {inner}
    </Link>
  );
}
