"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Store, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { pdvSellsOnline } from "@/lib/pdv";
import { brl } from "@/lib/utils";
import type { Pdv, Product } from "@/types";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { StickyCategoryNavigation } from "@/components/customer/sticky-category-nav";
import { ProductCard, ProductSection } from "@/components/customer/product-card";
import { ProductDetails } from "@/components/customer/product-details";
import { EmptyState } from "@/components/customer/ui/mafood-states";

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
  const sellsOnline = pdvSellsOnline(pdv);
  const categories = Array.from(new Set(products.map((p) => p.category)));
  const [active, setActive] = useState(categories[0] ?? "");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.qty ?? 0;
  const c = count();

  return (
    <div className={`min-h-dvh-100 ${sellsOnline ? "pb-36" : "pb-24"}`}>
      <RestaurantHeader venue={venue} pdv={pdv} />

      {/* Bifurcação: PDVs sem venda online pagam no balcão */}
      {!sellsOnline && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3 rounded-mafood-md border border-mafood-border bg-mafood-background-soft px-4 py-3.5 shadow-mafood-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mafood-primary/10">
              <Store className="size-5 text-mafood-primary-strong" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-mafood-text-primary">
                Pagamento direto no balcão do PDV
              </p>
              <p className="text-[12px] leading-snug text-mafood-text-secondary">
                Confira o cardápio e faça o pedido no local.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navegação de categorias — barra fixa na base (aparece ao rolar) */}
      <StickyCategoryNavigation
        categories={categories}
        active={active}
        onSelect={setActive}
        raised={sellsOnline && c > 0}
      />

      {/* Cardápio */}
      <div className="mt-5 space-y-8 px-4">
        {products.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Nenhum item disponível no momento"
            hint="Volte mais tarde para conferir o cardápio."
          />
        ) : (
          categories.map((cat) => (
            <ProductSection key={cat} id={cat} title={cat}>
              {products
                .filter((p) => p.category === cat)
                .map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    sellsOnline={sellsOnline}
                    qty={qtyOf(p.id)}
                    onAdd={() => add(p)}
                    onRemove={() => remove(p.id)}
                    onOpen={() => setOpenProduct(p)}
                  />
                ))}
            </ProductSection>
          ))
        )}
      </div>

      {/* Barra flutuante do carrinho — somente para PDVs com venda online */}
      {sellsOnline && (
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
                  className="flex h-14 min-h-touch items-center justify-between gap-3 rounded-mafood-md bg-mafood-primary-strong px-4 text-white shadow-mafood-lg active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                >
                  <span className="inline-flex items-center gap-2 shrink-0">
                    <span className="grid size-7 place-items-center rounded-full bg-white/15">
                      <ShoppingBag className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">{c}</span>
                  </span>
                  <span className="truncate font-semibold">Ver carrinho</span>
                  <span className="shrink-0 font-semibold">{brl(total())}</span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Bottom sheet de detalhes */}
      {openProduct && (
        <ProductDetails
          product={openProduct}
          sellsOnline={sellsOnline}
          qty={qtyOf(openProduct.id)}
          onAdd={() => add(openProduct)}
          onRemove={() => remove(openProduct.id)}
          onClose={() => setOpenProduct(null)}
        />
      )}
    </div>
  );
}
