"use client";

import Image from "next/image";
import { Plus, Minus, UtensilsCrossed } from "lucide-react";
import { brl } from "@/lib/utils";
import type { Product } from "@/types";

const STATUS_LABEL: Record<Product["status"], string> = {
  active: "",
  paused: "Pausado",
  out_of_stock: "Esgotado",
};

/** Seção de categoria com título editorial (serif itálico) + âncora de scroll. */
export function ProductSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mafood-section-title text-fluid-xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/**
 * Cartão de produto. Texto à esquerda, imagem à direita (88px).
 * Tocar em qualquer área abre os detalhes (onOpen). Quando `sellsOnline`,
 * mostra o stepper de quantidade; caso contrário é apenas visualização.
 */
export function ProductCard({
  product,
  sellsOnline,
  qty,
  onAdd,
  onRemove,
  onOpen,
}: {
  product: Product;
  sellsOnline: boolean;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const disabled = product.status !== "active";
  const showControls = sellsOnline && !disabled;

  return (
    <div
      className={`relative flex gap-3 rounded-mafood-lg border border-mafood-border bg-mafood-surface-strong p-3 shadow-mafood-sm transition-shadow ${
        disabled ? "opacity-55" : "hover:shadow-mafood-md"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalhes de ${product.name}`}
        className="absolute inset-0 z-0 rounded-mafood-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
      />

      <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
        <h3 className="mafood-product-title text-[15px] leading-snug text-mafood-text-primary">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 text-[13px] leading-snug text-mafood-text-secondary line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold tabular-nums text-mafood-primary-strong">
            {brl(product.price)}
          </p>
          {disabled && (
            <span className="inline-block rounded-mafood-sm bg-mafood-background-soft px-2 py-0.5 text-[11px] font-semibold text-mafood-text-secondary">
              {STATUS_LABEL[product.status]}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 shrink-0 pointer-events-none">
        <div className="size-[88px] overflow-hidden rounded-mafood-md bg-mafood-background-soft border border-mafood-border">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={88}
              height={88}
              sizes="88px"
              className="size-full object-cover"
            />
          ) : (
            <div
              className="grid size-full place-items-center text-mafood-text-muted"
              aria-hidden="true"
            >
              <UtensilsCrossed className="size-7 opacity-50" />
            </div>
          )}
        </div>

        {showControls && (
          <div className="pointer-events-auto absolute -bottom-2 right-1">
            {qty === 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                aria-label={`Adicionar ${product.name}`}
                className="grid size-11 place-items-center rounded-full bg-mafood-primary-strong text-white shadow-mafood-md active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
              >
                <Plus className="size-5" />
              </button>
            ) : (
              <div className="flex items-center gap-0.5 rounded-full bg-mafood-surface-strong p-0.5 shadow-mafood-md border border-mafood-border">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  aria-label={`Remover 1 ${product.name}`}
                  className="grid size-11 place-items-center rounded-full text-mafood-primary-strong active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="w-5 text-center text-sm font-semibold tabular-nums text-mafood-text-primary"
                  aria-live="polite"
                  aria-label={`${qty} no carrinho`}
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  aria-label={`Adicionar mais 1 ${product.name}`}
                  className="grid size-11 place-items-center rounded-full bg-mafood-primary-strong text-white active:scale-90 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
