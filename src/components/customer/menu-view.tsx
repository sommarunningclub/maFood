"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Clock, Store, UtensilsCrossed } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import { pdvAcceptsAppOrders, pdvPayAtCounter } from "@/lib/pdv";
import type { Pdv, Product } from "@/types";
import { RestaurantHeader } from "@/components/customer/restaurant-header";
import {
  ALL_CATEGORIES,
  StickyCategoryNavigation,
} from "@/components/customer/sticky-category-nav";
import { ProductCard, ProductSection } from "@/components/customer/product-card";
import { ProductDetails } from "@/components/customer/product-details";
import { CartSheet } from "@/components/customer/cart-sheet";
import { CartFab } from "@/components/customer/cart-fab";
import { EmptyState } from "@/components/customer/ui/mafood-states";
import { useConfirm } from "@/components/customer/ui/confirm-sheet";
import { rememberLastPdv } from "@/components/customer/bottom-nav";

type MenuPdv = Pdv & { instagram_handle?: string | null };

export function MenuView({
  venue,
  pdv,
  products,
  openCart = false,
}: {
  venue: string;
  pdv: MenuPdv;
  products: Product[];
  /** Abre a sacola (CartSheet) ao chegar — usado pelo link ?sacola=1 da home. */
  openCart?: boolean;
}) {
  const {
    items,
    add,
    remove,
    clear,
    count,
    total,
    qtyOf,
    hasHydrated,
    reconcile,
    pdvId: cartPdvId,
    pdvName: cartPdvName,
  } = useCart();
  const { confirm, confirmElement } = useConfirm();
  const payAtCounter = pdvPayAtCounter(pdv);
  const acceptsOrders = pdvAcceptsAppOrders(pdv);
  const canOrder = acceptsOrders && pdv.is_open;

  const visibleProducts = useMemo(() => {
    const activeItems = products.filter((p) => p.status === "active");
    const oos = products.filter((p) => p.status === "out_of_stock");
    return [...activeItems, ...oos];
  }, [products]);

  const productCategories = useMemo(
    () => Array.from(new Set(visibleProducts.map((p) => p.category || "Outros"))),
    [visibleProducts]
  );

  // "Todos" sempre primeiro
  const navCategories = useMemo(
    () =>
      productCategories.length > 0
        ? [ALL_CATEGORIES, ...productCategories]
        : [],
    [productCategories]
  );

  const [active, setActive] = useState(ALL_CATEGORIES);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // A store de carrinho re-hidrata do localStorage de forma síncrona, então o
  // 1º render do cliente já teria itens enquanto o servidor renderiza vazio.
  // `mounted` só vira true após montar → server e 1º render batem (sem sacola)
  // e a bolinha entra depois, evitando erro de hidratação.
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevCatIndex = useRef(0);
  const categoryAnimationReady = useRef(false);

  useEffect(() => setMounted(true), []);

  // Chegou via link ?sacola=1 (toque na sacola da home) → abre o CartSheet.
  // Roda só quando `mounted` vira true; não reabre depois que o usuário fecha.
  useEffect(() => {
    if (mounted && openCart) setCartOpen(true);
  }, [mounted, openCart]);

  useEffect(() => {
    rememberLastPdv(venue, pdv.slug);
  }, [venue, pdv.slug]);

  useEffect(() => {
    if (!hasHydrated) return;
    reconcile(products, { pdvId: pdv.id, payAtCounter });
  }, [hasHydrated, payAtCounter, pdv.id, products, reconcile]);

  useEffect(() => {
    if (navCategories.length && !navCategories.includes(active)) {
      setActive(ALL_CATEGORIES);
    }
  }, [navCategories, active]);

  const showAll = active === ALL_CATEGORIES;

  const categoryProducts = useMemo(() => {
    if (showAll) return visibleProducts;
    return visibleProducts.filter((p) => (p.category || "Outros") === active);
  }, [visibleProducts, active, showAll]);

  // Transição suave estilo app ao trocar categoria
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    if (!categoryAnimationReady.current) {
      categoryAnimationReady.current = true;
      gsap.set(el, { autoAlpha: 1, x: 0 });
      return;
    }

    const nextIndex = Math.max(0, navCategories.indexOf(active));
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
          stagger: 0.035,
          ease: "power2.out",
          delay: 0.04,
          overwrite: "auto",
        }
      );
    }
  }, [active, navCategories]);

  const c = count();
  const cartVisible = mounted && canOrder && c > 0 && !cartOpen;
  const navVisible = navCategories.length > 1;
  // Espaço na base: barra de categorias + folga p/ a bolinha não cobrir o
  // botão "+" do último card quando a sacola está visível.
  const bottomPad = cartVisible
    ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))]"
    : "pb-[calc(4.5rem+env(safe-area-inset-bottom))]";

  function handleCartAdd(productId: string, sizeLabel?: string) {
    const item = items.find(
      (i) =>
        i.product.id === productId &&
        (i.sizeLabel ?? "") === (sizeLabel ?? "")
    );
    if (item) {
      add(item.product, {
        payAtCounter,
        sizeLabel: item.sizeLabel,
        pdvName: pdv.name,
      });
    }
  }

  // Adiciona respeitando "uma sacola por restaurante": se já há itens de OUTRO
  // PDV, confirma antes de trocar (hoje a store trocava em silêncio).
  async function attemptAdd(
    product: Product,
    opts: { payAtCounter: boolean; sizeLabel?: string }
  ) {
    const foreignCart =
      cartPdvId != null && cartPdvId !== product.pdv_id && items.length > 0;
    if (foreignCart) {
      const ok = await confirm({
        title: "Trocar de sacola?",
        description: `Você tem itens de ${
          cartPdvName ?? "outro restaurante"
        }. Você paga um restaurante por vez — limpar a sacola e começar em ${
          pdv.name
        }?`,
        confirmLabel: "Trocar",
        cancelLabel: "Cancelar",
        destructive: true,
      });
      if (!ok) return;
      setOpenProduct(null);
    }
    add(product, { ...opts, pdvName: pdv.name });
  }

  function handleSelectCategory(cat: string) {
    if (cat === active) return;
    setActive(cat);
    window.requestAnimationFrame(() => {
      const headerBottom =
        document.querySelector<HTMLElement>("[data-slim-header]")?.getBoundingClientRect()
          .bottom ?? 0;
      const y = window.scrollY + (listRef.current?.getBoundingClientRect().top ?? 0);
      window.scrollTo({
        top: Math.max(0, y - headerBottom - 12),
        behavior: "smooth",
      });
    });
  }

  return (
    <div className={`min-h-dvh-100 ${bottomPad}`}>
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

          {pdv.is_open && payAtCounter && (
            <div className="flex items-center gap-3 rounded-mafood-md border border-mafood-border bg-mafood-background-soft px-4 py-3.5 shadow-mafood-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mafood-primary/10">
                <Store className="size-5 text-mafood-primary-strong" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-mafood-text-primary">
                  Pedido no app · pagamento na tenda
                </p>
                <p className="text-[12px] leading-snug text-mafood-text-secondary">
                  Monte a sacola aqui. O pagamento é feito na maquininha deste PDV.
                </p>
              </div>
            </div>
          )}

          {pdv.is_open && !acceptsOrders && (
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

        <div ref={listRef} className="mt-5 space-y-8 pb-4">
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
              hint="Escolha outra categoria no menu abaixo."
            />
          ) : showAll ? (
            productCategories.map((cat) => (
              <ProductSection key={cat} id={`cat-${cat}`} title={cat}>
                {visibleProducts
                  .filter((p) => (p.category || "Outros") === cat)
                  .map((p) => (
                    <div key={p.id} data-product-card>
                      <ProductCard
                        product={p}
                        sellsOnline={canOrder}
                        qty={qtyOf(p.id)}
                        onAdd={() => attemptAdd(p, { payAtCounter })}
                        onRemove={() => remove(p.id)}
                        onOpen={() => setOpenProduct(p)}
                      />
                    </div>
                  ))}
              </ProductSection>
            ))
          ) : (
            <ProductSection id={`cat-${active}`} title={active}>
              {categoryProducts.map((p) => (
                <div key={p.id} data-product-card>
                  <ProductCard
                    product={p}
                    sellsOnline={canOrder}
                    qty={qtyOf(p.id)}
                    onAdd={() => attemptAdd(p, { payAtCounter })}
                    onRemove={() => remove(p.id)}
                    onOpen={() => setOpenProduct(p)}
                  />
                </div>
              ))}
            </ProductSection>
          )}
        </div>
      </div>

      <StickyCategoryNavigation
        categories={navCategories}
        active={active}
        onSelect={handleSelectCategory}
      />

      <AnimatePresence>
        {cartVisible && (
          <CartFab
            count={c}
            navVisible={navVisible}
            onClick={() => {
              setOpenProduct(null);
              setCartOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      {openProduct && (
        <ProductDetails
          product={openProduct}
          sellsOnline={canOrder}
          payAtCounter={payAtCounter}
          isOpen={pdv.is_open}
          onAdd={(sizeLabel) =>
            attemptAdd(openProduct, { payAtCounter, sizeLabel })
          }
          onRemove={(sizeLabel) => remove(openProduct.id, sizeLabel)}
          onClose={() => setOpenProduct(null)}
        />
      )}

      {cartOpen && c > 0 && (
        <CartSheet
          venue={venue}
          pdvSlug={pdv.slug}
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

      {confirmElement}
    </div>
  );
}
