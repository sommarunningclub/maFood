"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/stores/cart-store";
import { brl } from "@/lib/utils";
import type { Pdv, Product } from "@/types";

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

  const qtyOf = (id: string) =>
    items.find((i) => i.product.id === id)?.qty ?? 0;
  const c = count();

  return (
    <div className="pb-28 somma-grain min-h-screen">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-somma-bg/90 backdrop-blur border-b border-somma-border px-5 py-4 flex items-center gap-3">
        <Link href={`/${venue}`} className="text-somma-muted text-xl">
          ←
        </Link>
        <div className="text-3xl">{pdv.logo_url}</div>
        <div>
          <h1 className="text-white font-display uppercase tracking-wide text-xl leading-none">
            {pdv.name}
          </h1>
          <p className="num text-[11px] text-somma-muted mt-0.5">
            ⏱ {pdv.prep_time_min} min · {pdv.category}
          </p>
        </div>
      </header>

      {/* Categorias */}
      <nav className="sticky top-[73px] z-10 bg-somma-bg/90 backdrop-blur flex gap-2 overflow-x-auto px-5 py-3 no-scrollbar">
        {categories.map((cat) => (
          <a
            key={cat}
            href={`#${cat}`}
            onClick={() => setActive(cat)}
            className={`whitespace-nowrap num text-xs px-3 py-1.5 rounded-client border transition-colors ${
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
      <div className="px-5 space-y-6 mt-2">
        {categories.map((cat) => (
          <section key={cat} id={cat} className="scroll-mt-32">
            <h2 className="text-white font-display uppercase tracking-wide mb-3">
              {cat}
            </h2>
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
                      {/* Slot da imagem (88px). Placeholder quando vazio. */}
                      <div className="relative size-[88px] shrink-0 overflow-hidden rounded-client bg-somma-surface2 border border-somma-border">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
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
                        <p className="text-somma-muted text-xs mt-0.5 leading-snug">
                          {p.description}
                        </p>
                        <p className="num text-somma-orange font-semibold mt-2">
                          {brl(p.price)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-center">
                        {disabled ? (
                          <span className="num text-[10px] text-somma-red">
                            {STATUS_LABEL[p.status]}
                          </span>
                        ) : q === 0 ? (
                          <button
                            onClick={() => add(p)}
                            className="size-9 rounded-client bg-somma-orange text-white text-xl flex items-center justify-center active:scale-90 transition-transform"
                            aria-label={`Adicionar ${p.name}`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 num">
                            <button
                              onClick={() => remove(p.id)}
                              className="size-8 rounded-client border border-somma-border text-white text-lg flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-white w-4 text-center">{q}</span>
                            <button
                              onClick={() => add(p)}
                              className="size-8 rounded-client bg-somma-orange text-white text-lg flex items-center justify-center"
                            >
                              +
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

      {/* Barra flutuante carrinho */}
      <AnimatePresence>
        {c > 0 && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="fixed bottom-0 inset-x-0 z-30"
          >
            <div className="mx-auto max-w-md p-4">
              <Link
                href={`/${venue}/checkout`}
                className="flex items-center justify-between rounded-client bg-somma-orange px-5 h-14 text-white font-display uppercase tracking-wide shadow-lg shadow-somma-orange/30 active:scale-[0.98] transition-transform"
              >
                <span className="num text-sm bg-black/20 px-2 py-1 rounded">
                  {c}
                </span>
                <span>Ver carrinho</span>
                <span className="num">{brl(total())}</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
