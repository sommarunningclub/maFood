"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { PdvLogo } from "@/components/pdv-logo";
import { pdvSellsOnline } from "@/lib/pdv";
import type { PdvCardData } from "@/components/customer/marketplace-view";
import { EmptyState } from "@/components/customer/ui/mafood-states";

function normalize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function SearchModal({
  open,
  onClose,
  venueSlug,
  pdvs,
}: {
  open: boolean;
  onClose: () => void;
  venueSlug: string;
  pdvs: PdvCardData[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    setQuery("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener.current?.focus();
    };
  }, [open]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pdvs) if (p.category) set.add(p.category);
    return Array.from(set);
  }, [pdvs]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return pdvs.filter(
      (p) =>
        normalize(p.name).includes(q) ||
        (p.category ? normalize(p.category).includes(q) : false)
    );
  }, [query, pdvs]);

  if (!open) return null;

  const hasQuery = normalize(query).length > 0;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar restaurantes"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex flex-col bg-mafood-background pt-safe animate-slide-in">
        {/* Barra de busca */}
        <div className="mafood-header-gradient px-4 pt-3 pb-4 pt-safe">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 h-12 rounded-mafood-md bg-mafood-surface-strong px-3 shadow-mafood-sm">
              <Search className="size-4 shrink-0 text-mafood-primary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar restaurantes ou categorias"
                placeholder="Buscar restaurantes, categorias…"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-mafood-text-primary placeholder:text-mafood-text-muted focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-mafood-text-muted hover:bg-mafood-background-soft"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar busca"
              className="grid size-11 shrink-0 place-items-center rounded-mafood-md bg-white/10 border border-white/15 text-white active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasQuery ? (
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-mafood-text-muted">
                Categorias
              </p>
              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setQuery(c)}
                      className="rounded-mafood-sm bg-mafood-surface-strong border border-mafood-border px-3 py-2 text-sm text-mafood-text-primary shadow-mafood-sm active:scale-[0.97] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-mafood-text-muted">
                  Digite o nome de um restaurante para começar.
                </p>
              )}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title={`Nada encontrado para “${query.trim()}”`}
              hint="Tente outro nome ou categoria."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((pdv) => (
                <SearchResult
                  key={pdv.id}
                  pdv={pdv}
                  venueSlug={venueSlug}
                  onNavigate={onClose}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchResult({
  pdv,
  venueSlug,
  onNavigate,
}: {
  pdv: PdvCardData;
  venueSlug: string;
  onNavigate: () => void;
}) {
  const online = pdvSellsOnline(pdv);
  const inner = (
    <div className="flex items-center gap-3 rounded-mafood-md bg-mafood-surface-strong border border-mafood-border p-3 shadow-mafood-sm">
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-mafood-background-soft ring-1 ring-mafood-border">
        <PdvLogo logoUrl={pdv.logo_url} size={48} alt={pdv.name} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mafood-restaurant-title text-[15px] leading-tight text-mafood-text-primary truncate">
          {pdv.name}
        </p>
        <p className="text-xs text-mafood-text-muted truncate">
          {pdv.category ?? "Restaurante"}
          {!pdv.is_open && " · Fechado"}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-mafood-sm px-2 py-0.5 text-[10px] font-semibold ${
          online
            ? "bg-mafood-accent text-white"
            : "border border-mafood-border text-mafood-text-secondary"
        }`}
      >
        {online ? "Pedir aqui" : "Cardápio"}
      </span>
    </div>
  );

  if (!pdv.is_open) {
    return (
      <li className="opacity-55 pointer-events-none select-none">{inner}</li>
    );
  }

  return (
    <li>
      <Link
        href={`/${venueSlug}/${pdv.slug}`}
        onClick={onNavigate}
        aria-label={`Abrir ${pdv.name}`}
        className="block rounded-mafood-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary active:scale-[0.99] transition-transform"
      >
        {inner}
      </Link>
    </li>
  );
}
