"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowRight, Clock, Instagram, ShoppingBag } from "lucide-react";
import { brl } from "@/lib/utils";
import { PdvLogo } from "@/components/pdv-logo";

export interface PdvCardData {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  is_open: boolean;
  prep_time_min: number;
  instagram_handle: string | null;
  product_count: number;
  price_min: number | null;
  price_max: number | null;
}

type Filter = "all" | "open";

export function MarketplaceView({
  venueSlug,
  venueName,
  venueDescription,
  pdvs,
}: {
  venueSlug: string;
  venueName: string;
  venueDescription: string | null;
  pdvs: PdvCardData[];
}) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const openCount = useMemo(() => pdvs.filter((p) => p.is_open).length, [pdvs]);
  const totalProducts = useMemo(
    () => pdvs.reduce((s, p) => s + p.product_count, 0),
    [pdvs]
  );

  const visible = useMemo(() => {
    return filter === "open" ? pdvs.filter((p) => p.is_open) : pdvs;
  }, [filter, pdvs]);

  // Entrada com GSAP — stagger no hero + stats + cards
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(heroRef.current?.children ?? [], {
        y: 20,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.08,
      });
      gsap.from(statsRef.current, {
        y: 12,
        opacity: 0,
        duration: 0.6,
        delay: 0.25,
        ease: "power2.out",
      });
    });
    return () => ctx.revert();
  }, []);

  // Stagger nos cards quando o filtro muda
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll("[data-pdv-card]");
    gsap.fromTo(
      cards,
      { y: 24, opacity: 0, scale: 0.96 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.06,
      }
    );
  }, [visible]);

  return (
    <div className="pb-16 pb-safe">
      {/* Hero */}
      <header
        ref={heroRef}
        className="relative px-5 pt-8 pb-8 sm:pt-12 sm:pb-12 text-center max-w-2xl mx-auto"
      >
        <p className="num text-[10px] sm:text-[11px] text-white/70 tracking-[0.3em] uppercase mb-3">
          18 jul 2026 · COPMDF · Brasília
        </p>
        <h1 className="font-display uppercase text-fluid-3xl sm:text-fluid-4xl leading-[0.95] text-balance text-white">
          {venueName}
        </h1>
        {venueDescription && (
          <p className="text-white/85 text-sm sm:text-base mt-4 max-w-md mx-auto text-pretty leading-relaxed">
            {venueDescription}
          </p>
        )}

        {/* Stats — chip linha */}
        <div
          ref={statsRef}
          className="mt-6 inline-flex items-center gap-2 sm:gap-3 rounded-full bg-black/15 backdrop-blur-sm border border-white/15 px-3 sm:px-4 py-1.5 sm:py-2"
        >
          <Stat label="PDVs" value={pdvs.length} />
          <Divider />
          <Stat
            label="Abertos"
            value={openCount}
            dot={openCount > 0 ? "live" : undefined}
          />
          <Divider />
          <Stat label="Itens" value={totalProducts} />
        </div>
      </header>

      {/* Filter pills */}
      {pdvs.length > 1 && (
        <div className="px-5 mb-5 sm:mb-6 flex items-center justify-center gap-2">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos ({pdvs.length})
          </FilterPill>
          <FilterPill
            active={filter === "open"}
            onClick={() => setFilter("open")}
          >
            Abertos ({openCount})
          </FilterPill>
        </div>
      )}

      {/* Grid */}
      <section className="px-4 sm:px-6 max-w-5xl mx-auto">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-white/80">
            <p className="text-sm">
              {filter === "open"
                ? "Nenhum PDV está aberto agora."
                : "Nenhum PDV cadastrado ainda."}
            </p>
            {filter === "open" && (
              <button
                onClick={() => setFilter("all")}
                className="mono mt-3 text-[11px] underline underline-offset-4 text-white/90 min-h-touch px-3"
              >
                ver todos
              </button>
            )}
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((pdv) => (
              <PdvCard key={pdv.id} venue={venueSlug} pdv={pdv} />
            ))}
          </div>
        )}
      </section>

      {/* Footer link */}
      <footer className="mt-10 sm:mt-12 text-center">
        <Link
          href={`/${venueSlug}/history`}
          className="num inline-flex items-center gap-2 text-[11px] sm:text-xs text-white/85 underline-offset-4 hover:underline min-h-touch px-3"
        >
          <ShoppingBag className="size-3.5" />
          Ver meus pedidos
        </Link>
      </footer>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────

function Stat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: "live";
}) {
  return (
    <div className="flex items-center gap-1.5">
      {dot === "live" && (
        <span className="relative inline-flex size-1.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-somma-green animate-ping opacity-75" />
          <span className="relative size-1.5 rounded-full bg-somma-green" />
        </span>
      )}
      <span className="num text-white font-semibold text-xs sm:text-sm">{value}</span>
      <span className="num text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-white/70">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-white/25" />;
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`mono rounded-full px-3.5 min-h-9 text-[11px] uppercase tracking-wider transition-all ${
        active
          ? "bg-white text-somma-orange shadow-sm"
          : "bg-black/10 text-white/85 border border-white/15 hover:bg-black/20"
      }`}
    >
      {children}
    </button>
  );
}

function PdvCard({ venue, pdv }: { venue: string; pdv: PdvCardData }) {
  const hasRange =
    pdv.price_min != null && pdv.price_max != null && pdv.product_count > 0;
  const priceLabel = hasRange
    ? pdv.price_min === pdv.price_max
      ? brl(pdv.price_min!)
      : `${brl(pdv.price_min!)} – ${brl(pdv.price_max!)}`
    : null;

  const content = (
    <div className="relative h-full flex flex-col rounded-2xl bg-somma-bg border border-white/10 p-4 sm:p-5 shadow-[0_10px_28px_rgba(0,0,0,0.28)] overflow-hidden">
      {/* Glow no canto */}
      <div className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-somma-orange/15 blur-2xl" />

      {/* Linha topo: logo + status */}
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div className="size-14 sm:size-16 grid place-items-center rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden">
          <PdvLogo logoUrl={pdv.logo_url} size={56} />
        </div>
        <StatusBadge isOpen={pdv.is_open} />
      </div>

      {/* Nome + categoria */}
      <h3 className="font-display uppercase tracking-wide text-base sm:text-lg leading-tight text-white text-balance">
        {pdv.name}
      </h3>
      {pdv.category && (
        <p className="num text-[10px] text-white/55 uppercase tracking-[0.2em] mt-1">
          {pdv.category}
        </p>
      )}

      {/* Meta info */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/70">
        <span className="inline-flex items-center gap-1">
          <ShoppingBag className="size-3" />
          <span className="num">{pdv.product_count} item{pdv.product_count !== 1 ? "s" : ""}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          <span className="num">~{pdv.prep_time_min}min</span>
        </span>
        {pdv.instagram_handle && (
          <span className="inline-flex items-center gap-1 text-white/55">
            <Instagram className="size-3" />
            <span className="num">@{pdv.instagram_handle}</span>
          </span>
        )}
      </div>

      {/* Preço + CTA */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="min-w-0">
          {priceLabel ? (
            <>
              <p className="num text-[9px] uppercase tracking-[0.2em] text-white/45">
                a partir de
              </p>
              <p className="num text-sm font-semibold text-white truncate">
                {priceLabel}
              </p>
            </>
          ) : (
            <p className="num text-[10px] text-white/45">sem itens cadastrados</p>
          )}
        </div>
        {pdv.is_open && (
          <span className="grid size-9 place-items-center rounded-full bg-somma-orange text-white shrink-0 transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );

  if (!pdv.is_open) {
    return (
      <div data-pdv-card className="relative opacity-50 pointer-events-none">
        {content}
      </div>
    );
  }

  return (
    <Link
      data-pdv-card
      href={`/${venue}/${pdv.slug}`}
      aria-label={`Ver cardápio do ${pdv.name}`}
      className="group block focus-ring rounded-2xl transition-all hover:-translate-y-0.5 active:scale-[0.99]"
    >
      {content}
    </Link>
  );
}

function StatusBadge({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-somma-green/15 border border-somma-green/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-somma-green">
        <span className="relative inline-flex size-1.5">
          <span className="absolute inset-0 rounded-full bg-somma-green animate-ping opacity-75" />
          <span className="relative size-1.5 rounded-full bg-somma-green" />
        </span>
        Aberto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-somma-red/15 border border-somma-red/30 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-somma-red">
      Fechado
    </span>
  );
}
