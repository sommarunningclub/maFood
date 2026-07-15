"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { X, Plus, Minus, Store, UtensilsCrossed } from "lucide-react";
import { brl } from "@/lib/utils";
import type { Product } from "@/types";

const STATUS_LABEL: Record<Product["status"], string> = {
  active: "",
  paused: "Pausado",
  out_of_stock: "Esgotado",
};

/**
 * Bottom sheet com os detalhes do produto. Imagem larga, descrição completa
 * e, quando `sellsOnline`, controle de quantidade + botão "Adicionar".
 * Caso contrário exibe a nota de pagamento no balcão.
 * Foca o primeiro controle ao abrir, restaura o foco ao fechar e trava o scroll.
 */
export function ProductDetails({
  product,
  sellsOnline,
  isOpen = true,
  qty,
  onAdd,
  onRemove,
  onClose,
}: {
  product: Product;
  sellsOnline: boolean;
  isOpen?: boolean;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const disabled = product.status !== "active";
  const canOrder = sellsOnline && isOpen && !disabled;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    opener.current = document.activeElement as HTMLElement;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    const first = panelRef.current?.querySelector<HTMLElement>("button");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startY = useRef(0);
  const currentDY = useRef(0);
  const dragging = useRef(false);

  const onHeroTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentDY.current = 0;
    dragging.current = true;
  };

  const onHeroTouchMove = (e: React.TouchEvent) => {
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

  const onHeroTouchEnd = () => {
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

  useEffect(() => {
    return () => {
      if (panelRef.current) {
        panelRef.current.style.transform = "";
        panelRef.current.style.transition = "";
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative w-full max-h-[88dvh] overflow-y-auto overscroll-y-contain rounded-t-mafood-xl bg-mafood-surface shadow-mafood-lg pb-safe animate-slide-in"
      >
        {/* Imagem larga + fechar */}
        <div
          className="relative aspect-[16/10] w-full overflow-hidden bg-mafood-background-soft"
          onTouchStart={onHeroTouchStart}
          onTouchMove={onHeroTouchMove}
          onTouchEnd={onHeroTouchEnd}
        >
          <div
            className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2"
            aria-hidden
            onTouchStart={onHeroTouchStart}
            onTouchMove={onHeroTouchMove}
            onTouchEnd={onHeroTouchEnd}
          >
            <div className="h-1.5 w-10 rounded-full bg-white/70 shadow-mafood-sm" />
          </div>
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="100vw"
              priority
              className="size-full object-cover"
            />
          ) : (
            <div
              className="grid size-full place-items-center text-mafood-text-muted"
              aria-hidden="true"
            >
              <UtensilsCrossed className="size-16 opacity-40" />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 pt-5">
          <h2 className="mafood-product-title text-fluid-xl leading-tight text-mafood-text-primary text-balance">
            {product.name}
          </h2>
          <p className="mt-2 text-fluid-lg font-semibold text-mafood-primary-strong">
            {brl(product.price)}
          </p>
          {disabled && (
            <span className="mt-2 inline-block rounded-mafood-sm bg-mafood-background-soft px-2.5 py-1 text-xs font-semibold text-mafood-text-secondary">
              {STATUS_LABEL[product.status]}
            </span>
          )}
          {product.description && (
            <p className="mt-4 text-[15px] leading-relaxed text-mafood-text-secondary text-pretty">
              {product.description}
            </p>
          )}
        </div>

        {/* Rodapé de ação */}
        <div className="px-5 pb-5 pt-6">
          {canOrder ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-mafood-border bg-mafood-surface-strong p-1 shadow-mafood-sm">
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={qty === 0}
                  aria-label={`Remover 1 ${product.name}`}
                  className="grid size-11 place-items-center rounded-full text-mafood-primary-strong disabled:opacity-40 active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
                >
                  <Minus className="size-5" />
                </button>
                <span
                  className="w-7 text-center text-base font-semibold text-mafood-text-primary"
                  aria-live="polite"
                  aria-label={`${qty} no carrinho`}
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label={`Adicionar mais 1 ${product.name}`}
                  className="grid size-11 place-items-center rounded-full bg-mafood-primary-strong text-white active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={onAdd}
                className="flex h-13 min-h-touch flex-1 items-center justify-between gap-3 rounded-mafood-md bg-mafood-primary-strong px-4 text-[15px] font-semibold text-white shadow-mafood-md active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <span>{qty === 0 ? "Adicionar" : "Adicionar mais"}</span>
                <span className="tabular-nums opacity-95">{brl(product.price)}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-mafood-md border border-mafood-border bg-mafood-background-soft px-4 py-3.5">
              <Store className="size-5 shrink-0 text-mafood-primary-strong" aria-hidden="true" />
              <p className="text-[14px] font-medium text-mafood-text-secondary">
                {disabled
                  ? STATUS_LABEL[product.status] || "Indisponível no momento"
                  : !isOpen
                    ? "PDV fechado — pedidos online indisponíveis"
                    : "Pagamento direto no balcão do PDV"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
