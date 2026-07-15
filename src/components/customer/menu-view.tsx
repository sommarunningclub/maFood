"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Clock, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { pdvSellsOnline } from "@/lib/pdv";
import { brl } from "@/lib/utils";
import type { Pdv, Product } from "@/types";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import { StickyCategoryNavigation } from "@/components/customer/sticky-category-nav";
import { ProductCard, ProductSection } from "@/components/customer/product-card";
import { ProductDetails } from "@/components/customer/product-details";
import { CartSheet } from "@/components/customer/cart-sheet";
import { EmptyState } from "@/components/customer/ui/mafood-states";
import { rememberLastPdv } from "@/components/customer/bottom-nav";

type MenuPdv = Pdv & { instagram_handle?: string | null };

export function MenuView({
  venue,
  pdv,
  products,
}: {
  venue: string;
  pdv: MenuPdv;
  products: Product[];
}) {
  const { items, add, remove, clear, count, total } = useCart();
  const sellsOnline = pdvSellsOnline(pdv);
  const canOrder = sellsOnline && pdv.is_open;

  const visibleProducts = useMemo(() => {
    const activeItems = products.filter((p) => p.status === "active");
    const oos = products.filter((p) => p.status === "out_of_stock");
    return [...activeItems, ...oos];
  }, [products]);

  const categories = useMemo(
    () => Array.from(new Set(visibleProducts.map((p) => p.category || "Outros"))),
    [visibleProducts]
  );

  const [active, setActive] = useState(categories[0] ?? "");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCatIndex = useRef(0);

  useEffect(() => {
    rememberLastPdv(venue, pdv.slug);
  }, [venue, pdv.slug]);

  useEffect(() => {
    if (categories.length && !categories.includes(active)) {
      setActive(categories[0] ?? "");
    }
  }, [categories, active]);

  const categoryProducts = useMemo(
    () =>
      visibleProducts.filter((p) => (p.category || "Outros") === active),
    [visibleProducts, active]
  );

  // Transição suave estilo app ao trocar categoria (slide + fade + stagger)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const nextIndex = Math.max(0, categories.indexOf(active));
    const dir = nextIndex >= prevCatIndex.current ? 1 : -1;
    prevCatIndex.current = nextIndex;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      gsap.set(el, { autoAlpha: 1, x: 0 });
      return;
    }

    const cards = el.querySelectorAll("[data-product-card]");
    gsap.killTweensOf([el, ...Array.from(cards)]);

    gsap.fromTo(
      el,
      { autoAlpha: 0, x: 18 * dir },
      {
        autoAlpha: 1,
        x: 0,
        duration: 0.22,
        ease: "power2.out",
        overwrite: "auto",
        onComplete: () => {
          gsap.set(el, { clearProps: "transform" });
        },
      }
    );
    if (cards.length) {
      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          stagger: 0.04,
          ease: "power2.out",
          delay: 0.04,
          overwrite: "auto",
        }
      );
    }
  }, [active, categories]);

  const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.qty ?? 0;
  const c = count();

  function handleCartAdd(productId: string) {
    const item = items.find((i) => i.product.id === productId);
    if (item) add(item.product);
  }

  function handleSelectCategory(cat: string) {
    if (cat === active) return;
    setActive(cat);
    // Garante que a lista fique visível sob as pills
    window.requestAnimationFrame(() => {
      const nav = document.querySelector<HTMLElement>('[aria-label="Categorias"]');
      const top = nav
        ? Math.round(nav.getBoundingClientRect().bottom) + 8
        : 80;
      const listTop = listRef.current?.getBoundingClientRect().top ?? 0;
      if (listTop < top) {
        window.scrollBy({ top: listTop - top, behavior: "smooth" });
      }
    });
  }

  return (
    <div className={`min-h-dvh-100 ${canOrder && c > 0 ? "pb-28" : "pb-8"}`}>
      <RestaurantHeader venue={venue} pdv={pdv} />

      <div className="px-4">
        <div className="space-y-3 pt-4">
          {!pdv.is_open && (
            <div
              className="flex items-start gap-3 rounded-mafood-md border border-mafood-border bg-mafood-background-soft px-4 py-3.5 shadow-mafood-sm"
              role="status"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mafood-text-muted/15">
                <Clock className="size-5 text-mafood-text-secondary" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-mafood-text-primary">
                  Fechado no momento
                </p>
                <p className="text-[12px] leading-snug text-mafood-text-secondary">
                  Você pode ver o cardápio, mas pedidos online voltam quando o PDV abrir.
                </p>
              </div>
            </div>
          )}

          {pdv.is_open && !sellsOnline && (
            <div className="flex items-center gap-3 rounded-mafood-md border border-mafood-border bg-mafood-background-soft px-4 py-3.5 shadow-mafood-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mafood-primary/10">
                <Store className="size-5 text-mafood-primary-strong" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-mafood-text-primary">
                  Pagamento no balcão
                </p>
                <p className="text-[12px] leading-snug text-mafood-text-secondary">
                  Confira o cardápio e faça o pedido no local.
                </p>
              </div>
            </div>
          )}
        </div>

        <StickyCategoryNavigation
          categories={categories}
          active={active}
          onSelect={handleSelectCategory}
        />

        <div ref={listRef} className="mt-5 space-y-8 pb-4" style={{ opacity: 0 }}>
          {visibleProducts.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Nenhum item disponível no momento"
              hint="Volte mais tarde para conferir o cardápio."
            />
          ) : categoryProducts.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Nada nesta categoria"
              hint="Escolha outra categoria no menu acima."
            />
          ) : (
            <ProductSection id={`cat-${active}`} title={active}>
              {categoryProducts.map((p) => (
                <div key={p.id} data-product-card>
                  <ProductCard
                    product={p}
                    sellsOnline={canOrder}
                    qty={qtyOf(p.id)}
                    onAdd={() => add(p)}
                    onRemove={() => remove(p.id)}
                    onOpen={() => setOpenProduct(p)}
                  />
                </div>
              ))}
            </ProductSection>
          )}
        </div>
      </div>

      {canOrder && (
        <AnimatePresence>
          {c > 0 && !cartOpen && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="fixed bottom-0 inset-x-0 z-30 pb-safe"
            >
              <div className="mx-auto max-w-screen-mobile p-3 sm:p-4 lg:max-w-3xl">
                <button
                  type="button"
                  onClick={() => {
                    setOpenProduct(null);
                    setCartOpen(true);
                  }}
                  className="flex h-14 min-h-touch w-full items-center justify-between gap-3 rounded-mafood-md bg-mafood-primary-strong px-4 text-white shadow-mafood-lg active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                >
                  <span className="inline-flex items-center gap-2.5 shrink-0">
                    <span className="grid size-8 place-items-center rounded-full bg-white/15">
                      <ShoppingBag className="size-4" aria-hidden="true" />
                    </span>
                    <span className="grid min-w-6 place-items-center rounded-full bg-white/20 px-1.5 text-xs font-bold tabular-nums">
                      {c}
                    </span>
                  </span>
                  <span className="truncate font-semibold">Ver sacola</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {brl(total())}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {openProduct && (
        <ProductDetails
          product={openProduct}
          sellsOnline={sellsOnline}
          isOpen={pdv.is_open}
          qty={qtyOf(openProduct.id)}
          onAdd={() => add(openProduct)}
          onRemove={() => remove(openProduct.id)}
          onClose={() => setOpenProduct(null)}
        />
      )}

      {cartOpen && c > 0 && (
        <CartSheet
          venue={venue}
          pdvName={pdv.name}
          items={items}
          total={total()}
          onAdd={handleCartAdd}
          onRemove={remove}
          onClear={() => {
            clear();
            setCartOpen(false);
          }}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}
