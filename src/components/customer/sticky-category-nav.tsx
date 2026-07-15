"use client";

import { useEffect, useRef } from "react";

export const ALL_CATEGORIES = "Todos";

/**
 * Barra de categorias fixa na BASE (thumb zone). Sobe quando a sacola
 * está visível para não competir com o CTA.
 */
export function StickyCategoryNavigation({
  categories,
  active,
  onSelect,
  raised = false,
}: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  /** Sobe a barra acima da sacola flutuante */
  raised?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(
      `[data-cat-active="true"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  if (categories.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      data-category-nav
      className={`fixed inset-x-0 z-30 border-t border-mafood-border bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/85 transition-[bottom] duration-200 ${
        raised
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          : "bottom-0 pb-safe"
      }`}
    >
      <div className="mx-auto flex max-w-screen-mobile gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar scroll-snap-x lg:max-w-3xl">
        {categories.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              type="button"
              data-cat-active={isActive}
              onClick={() => onSelect(cat)}
              aria-current={isActive ? "true" : undefined}
              className={`snap-start whitespace-nowrap shrink-0 inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
                isActive
                  ? "bg-mafood-primary-strong text-white shadow-mafood-sm"
                  : "border border-mafood-border text-mafood-text-secondary bg-mafood-surface-strong"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
