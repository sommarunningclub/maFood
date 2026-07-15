"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";

export function MaFoodHeader({
  venueSlug,
  onOpenSearch,
  onOpenMenu,
}: {
  venueSlug: string;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
}) {
  return (
    <header className="mafood-header-gradient sticky top-0 z-30 pt-safe rounded-b-mafood-lg text-white shadow-mafood-md">
      <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/${venueSlug}`} aria-label="SommaFood — início" className="mafood-display text-lg tracking-tight">
            SommaFood
          </Link>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            className="grid size-11 place-items-center rounded-mafood-md bg-white/10 backdrop-blur-sm border border-white/15 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar"
          className="flex items-center gap-2 w-full h-12 rounded-mafood-md bg-mafood-surface-strong text-mafood-text-muted px-4 shadow-mafood-sm active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <Search className="size-4 text-mafood-primary-strong" />
          <span className="text-sm">Buscar restaurantes, categorias…</span>
        </button>
      </div>
    </header>
  );
}
