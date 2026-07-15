"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, UtensilsCrossed, X } from "lucide-react";
import { brl } from "@/lib/utils";
import type { CartItem } from "@/types";
import { isSommaBar } from "@/lib/pdv";
import { BrandMomentGif } from "@/components/customer/brand-moment-gif";
import { cartItemUnitPrice } from "@/stores/cart-store";
import { lineDisplayName } from "@/lib/product-sizes";

/**
 * Bottom sheet de revisão da sacola — permite ajustar quantidades e
 * seguir para o checkout sem sair do cardápio.
 */
export function CartSheet({
  venue,
  pdvSlug,
  pdvName,
  items,
  total,
  onAdd,
  onRemove,
  onClear,
  onClose,
}: {
  venue: string;
  pdvSlug: string;
  pdvName: string;
  items: CartItem[];
  total: number;
  onAdd: (productId: string, sizeLabel?: string) => void;
  onRemove: (productId: string, sizeLabel?: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const showBrandGif = isSommaBar({ slug: pdvSlug, name: pdvName });
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const count = items.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (items.length === 0) {
      onCloseRef.current();
    }
  }, [items.length]);

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    const first = panelRef.current?.querySelector<HTMLElement>("button,a");
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          "a,button,input,[tabindex]:not([tabindex='-1'])"
        );
        if (nodes.length === 0) return;
        const firstEl = nodes[0];
        const lastEl = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      window.scrollTo(0, scrollY);
      opener.current?.focus();
    };
  }, []);

  const startY = useRef(0);
  const currentDY = useRef(0);
  const dragging = useRef(false);

  const onHandleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentDY.current = 0;
    dragging.current = true;
  };

  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || !panelRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      currentDY.current = 0;
      panelRef.current.style.transform = "";
      return;
    }
    currentDY.current = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  };

  const onHandleTouchEnd = () => {
    dragging.current = false;
    const panel = panelRef.current;
    if (!panel) return;
    if (currentDY.current > 120) {
      onCloseRef.current();
    } else {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (!reducedMotion) {
        panel.style.transition = "transform 0.2s ease-out";
        panel.style.transform = "";
        window.setTimeout(() => {
          if (panel) panel.style.transition = "";
        }, 200);
      } else {
        panel.style.transform = "";
      }
    }
    currentDY.current = 0;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Sua sacola"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-mafood-xl bg-mafood-surface shadow-mafood-lg pb-safe animate-slide-in"
      >
        <div
          className="shrink-0 px-4 pt-2"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="flex justify-center pb-2" aria-hidden>
            <div className="h-1.5 w-10 rounded-full bg-mafood-border" />
          </div>
          {showBrandGif && (
            <div className="flex justify-center py-1" aria-hidden>
              <BrandMomentGif variant="cart" size={128} />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 pb-3">
            <div className="min-w-0">
              <h2 className="mafood-product-title text-fluid-lg text-mafood-text-primary">
                Sua sacola
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-mafood-text-secondary">
                {pdvName}
                {" · "}
                {count} {count === 1 ? "item" : "itens"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onClear}
                aria-label="Esvaziar sacola"
                className="grid size-11 place-items-center rounded-full text-mafood-text-secondary hover:bg-mafood-background-soft active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="grid size-11 place-items-center rounded-full text-mafood-text-secondary hover:bg-mafood-background-soft active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-4 pb-3">
          {items.map((item) => {
            const { product, qty, sizeLabel } = item;
            const unit = cartItemUnitPrice(item);
            const label = lineDisplayName(product.name, sizeLabel);
            return (
            <li
              key={`${product.id}::${sizeLabel ?? ""}`}
              className="flex gap-3 rounded-mafood-md border border-mafood-border bg-mafood-surface-strong p-3"
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-mafood-sm border border-mafood-border bg-mafood-background-soft">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt=""
                    width={56}
                    height={56}
                    sizes="56px"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-mafood-text-muted">
                    <UtensilsCrossed className="size-5 opacity-50" aria-hidden />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="mafood-product-title text-[14px] leading-snug text-mafood-text-primary line-clamp-2">
                  {label}
                </p>
                <p className="mt-1 text-[13px] font-semibold tabular-nums text-mafood-primary-strong">
                  {brl(unit * qty)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 self-center rounded-full border border-mafood-border bg-mafood-surface p-0.5">
                <button
                  type="button"
                  onClick={() => onRemove(product.id, sizeLabel)}
                  aria-label={`Remover 1 ${label}`}
                  className="grid size-10 place-items-center rounded-full text-mafood-primary-strong active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="w-5 text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => onAdd(product.id, sizeLabel)}
                  aria-label={`Adicionar mais 1 ${label}`}
                  className="grid size-10 place-items-center rounded-full bg-mafood-primary-strong text-white active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
            );
          })}
        </ul>

        <div className="shrink-0 border-t border-mafood-border bg-mafood-surface px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between text-[14px]">
            <span className="text-mafood-text-secondary">Total</span>
            <span className="text-base font-semibold tabular-nums text-mafood-text-primary">
              {brl(total)}
            </span>
          </div>
          <Link
            href={`/${venue}/checkout`}
            className="flex h-14 min-h-touch items-center justify-between gap-3 rounded-mafood-md bg-mafood-primary-strong px-4 text-white shadow-mafood-md active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="size-4" aria-hidden />
              <span className="font-semibold">Ir para o pagamento</span>
            </span>
            <span className="font-semibold tabular-nums">{brl(total)}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full py-2.5 text-center text-[13px] font-medium text-mafood-text-secondary hover:text-mafood-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
          >
            Continuar pedindo
          </button>
        </div>
      </div>
    </div>
  );
}
