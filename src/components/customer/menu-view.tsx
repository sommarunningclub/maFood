"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import type { Pdv, Product } from "@/types";
import { PdvLogo } from "@/components/pdv-logo";

const STATUS_LABEL: Record<Product["status"], string> = {
  active: "",
  paused: "Pausado",
  out_of_stock: "Esgotado",
};

export function MenuView({
  venue,
  pdv,
  products,
}: {
  venue: string;
  pdv: Pdv;
  products: Product[];
}) {
  const { items, add, remove, count, total } = useCart();
  const categories = Array.from(new Set(products.map((p) => p.category)));
  const [active, setActive] = useState(categories[0]);

  const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.qty ?? 0;
  const c = count();

  return (
    <div className="pb-28 somma-grain min-h-dvh-100">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-somma-bg/90 backdrop-blur border-b border-somma-border px-4 sm:px-5 py-3 pt-safe flex items-center gap-3">
        <Link
          href={`/${venue}`}
          aria-label="Voltar à praça"
          className="grid size-touch -ml-2 place-items-center text-somma-muted hover:text-white focus-ring"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PdvLogo logoUrl={pdv.logo_url} size={40} />
        <div className="min-w-0">
          <h1 className="text-white font-display uppercase tracking-wide text-fluid-lg leading-none truncate">
            {pdv.name}
          </h1>
          <p className="num text-[11px] text-somma-muted mt-0.5 truncate">
            ⏱ {pdv.prep_time_min} min · {pdv.category}
          </p>
        </div>
      </header>

      {/* Categorias — chips scroll horizontal com snap */}
      <nav
        aria-label="Categorias"
        className="sticky top-[3.75rem] z-10 bg-somma-bg/90 backdrop-blur flex gap-2 overflow-x-auto px-4 sm:px-5 py-3 no-scrollbar scroll-snap-x"
      >
        {categories.map((cat) => (
          <a
            key={cat}
            href={`#${cat}`}
            onClick={() => setActive(cat)}
            className={`snap-start whitespace-nowrap num text-xs px-3 min-h-touch inline-flex items-center rounded-client border transition-colors focus-ring ${
              active === cat
                ? "bg-somma-orange text-white border-somma-orange"
                : "border-somma-border text-somma-muted"
            }`}
          >
            {cat}
          </a>
        ))}
      </nav>

      {/* Produtos */}
      <div className="px-4 sm:px-5 space-y-6 mt-2">
        {categories.map((cat) => (
          <section key={cat} id={cat} className="scroll-mt-36">
            <h2 className="text-white font-display uppercase tracking-wide mb-3">{cat}</h2>
            <div className="space-y-3">
              {products
                .filter((p) => p.category === cat)
                .map((p) => {
                  const disabled = p.status !== "active";
                  const q = qtyOf(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`rounded-client border border-somma-border bg-somma-surface p-3 flex gap-3 ${
                        disabled ? "opacity-50" : ""
                      }`}
                    >
                      <div className="relative size-[88px] shrink-0 overflow-hidden rounded-client bg-somma-surface2 border border-somma-border">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
                            loading="lazy"
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-somma-muted/50 text-2xl">
                            🍽
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium">{p.name}</h3>
                        {p.description && (
                          <p className="text-somma-muted text-xs mt-0.5 leading-snug line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <p className="num text-somma-orange font-semibold mt-2">{brl(p.price)}</p>
                      </div>
                      <div className="flex flex-col items-end justify-center shrink-0">
                        {disabled ? (
                          <span className="num text-[10px] text-somma-red">
                            {STATUS_LABEL[p.status]}
                          </span>
                        ) : q === 0 ? (
                          <button
                            onClick={() => add(p)}
                            className="grid size-touch place-items-center rounded-client bg-somma-orange text-white active:scale-90 transition-transform focus-ring"
                            aria-label={`Adicionar ${p.name}`}
                          >
                            <Plus className="size-5" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => remove(p.id)}
                              className="grid size-touch place-items-center rounded-client border border-somma-border text-white focus-ring"
                              aria-label={`Remover 1 ${p.name}`}
                            >
                              <Minus className="size-4" />
                            </button>
                            <span
                              className="num text-white w-7 text-center"
                              aria-live="polite"
                              aria-label={`${q} no carrinho`}
                            >
                              {q}
                            </span>
                            <button
                              onClick={() => add(p)}
                              className="grid size-touch place-items-center rounded-client bg-somma-orange text-white focus-ring"
                              aria-label={`Adicionar mais 1 ${p.name}`}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {/* Barra flutuante carrinho — respeita safe-area */}
      <AnimatePresence>
        {c > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-0 inset-x-0 z-30 pb-safe"
          >
            <div className="mx-auto max-w-screen-mobile p-3 sm:p-4">
              <Link
                href={`/${venue}/checkout`}
                className="flex items-center justify-between gap-3 rounded-client bg-somma-orange px-4 sm:px-5 h-14 min-h-touch text-white font-display uppercase tracking-wide shadow-lg shadow-somma-orange/30 active:scale-[0.98] transition-transform focus-ring"
              >
                <span className="num text-sm bg-black/20 px-2 py-1 rounded shrink-0">{c}</span>
                <span className="truncate">Ver carrinho</span>
                <span className="num shrink-0">{brl(total())}</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
