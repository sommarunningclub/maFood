"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { MaFoodHeader } from "@/components/customer/mafood-header";
import { MaFoodMenuDrawer } from "@/components/customer/mafood-menu-drawer";
import { SectionHeading } from "@/components/customer/ui/section-heading";
import { HorizontalCategoryList } from "@/components/customer/category-rail";
import { RestaurantGrid } from "@/components/customer/restaurant-grid";
import { SearchModal } from "@/components/customer/mafood-search";
import { MaFoodFooter } from "@/components/customer/mafood-footer";

export interface PdvCardData {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  is_open: boolean;
  prep_time_min: number;
  instagram_handle: string | null;
  sells_online?: boolean;
  product_count: number;
  price_min: number | null;
  price_max: number | null;
}

export function MarketplaceView({
  venueSlug,
  venueName,
  pdvs,
}: {
  venueSlug: string;
  venueName: string;
  venueDescription?: string | null;
  pdvs: PdvCardData[];
  dateLabel?: string;
}) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const openCount = useMemo(() => pdvs.filter((p) => p.is_open).length, [pdvs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pdvs) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [pdvs]);

  const visible = useMemo(() => {
    const list =
      activeCategory === "all"
        ? pdvs
        : pdvs.filter((p) => p.category === activeCategory);
    // Abertos primeiro — fechados continuam acessíveis no fim.
    return [...list].sort((a, b) => Number(b.is_open) - Number(a.is_open));
  }, [activeCategory, pdvs]);

  // Entrada com GSAP — stagger no hero.
  // GSAP anima estilos inline via JS/RAF, então o bloco CSS global de
  // prefers-reduced-motion NÃO o afeta — o gate precisa ser checado aqui, em JS.
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // no cleanup needed; elements are already in final state

    const ctx = gsap.context(() => {
      gsap.from(heroRef.current?.children ?? [], {
        y: 18,
        opacity: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.08,
      });
    });
    return () => ctx.revert();
  }, []);

  // Stagger nos cards quando a categoria muda (mesmo gate JS de reduced motion).
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll("[data-pdv-card]");
    if (cards.length === 0) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // fromTo() only sets its opacity:0/scale:0.97 "from" state when it runs,
    // so skipping the call entirely leaves cards at their natural, visible state.
    if (prefersReduced) return;

    gsap.fromTo(
      cards,
      { y: 20, opacity: 0, scale: 0.97 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      }
    );
  }, [visible]);

  return (
    <div className="min-h-dvh-100">
      <MaFoodHeader
        venueSlug={venueSlug}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <MaFoodMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        venueSlug={venueSlug}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        venueSlug={venueSlug}
        pdvs={pdvs}
      />

      {/* Hero */}
      <header ref={heroRef} className="px-4 pt-6 pb-2">
        <h1 className="mafood-display text-fluid-3xl leading-[1.05] text-mafood-text-primary text-balance">
          {venueName}
        </h1>
        <p className="mt-4 inline-flex items-center gap-2 rounded-mafood-sm bg-mafood-background-soft px-3 py-1.5 text-xs font-medium text-mafood-primary-strong">
          <span className="relative inline-flex size-2">
            <span className="absolute inset-0 rounded-full bg-mafood-success animate-ping opacity-60" />
            <span className="relative size-2 rounded-full bg-mafood-success" />
          </span>
          {openCount === 0
            ? "Nenhum restaurante aberto agora"
            : `${openCount} de ${pdvs.length} ${
                pdvs.length === 1 ? "restaurante aberto" : "restaurantes abertos"
              }`}
        </p>
      </header>

      {/* Explorar — categorias */}
      {categories.length > 0 && (
        <section className="mt-6 px-4">
          <SectionHeading>Explorar</SectionHeading>
          <div className="mt-3">
            <HorizontalCategoryList
              categories={categories}
              active={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        </section>
      )}

      {/* Restaurantes — grid */}
      <section className="mt-8 px-4">
        <SectionHeading>Restaurantes</SectionHeading>
        <div ref={gridRef} className="mt-3">
          <RestaurantGrid venueSlug={venueSlug} pdvs={visible} />
        </div>
      </section>

      <MaFoodFooter venueSlug={venueSlug} />

      <div className="h-4" />
    </div>
  );
}
