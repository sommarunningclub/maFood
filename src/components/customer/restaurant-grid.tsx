"use client";

import Link from "next/link";
import { brl } from "@/lib/utils";
import { PdvLogo } from "@/components/pdv-logo";
import { pdvPayAtCounter, pdvSellsOnline } from "@/lib/pdv";
import type { PdvCardData } from "@/components/customer/marketplace-view";
import { EmptyState } from "@/components/customer/ui/mafood-states";

/** Ponto verde + "Aberto", ou texto neutro "Fechado" — nunca hardcoded. */
export function RestaurantStatus({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mafood-success-strong">
        <span className="relative inline-flex size-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-mafood-success animate-ping opacity-60" />
          <span className="relative size-2 rounded-full bg-mafood-success" />
        </span>
        Aberto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mafood-text-secondary">
      <span className="size-2 shrink-0 rounded-full bg-mafood-text-muted/50" />
      Fechado
    </span>
  );
}

/** Categoria do PDV como pílula discreta. */
export function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-mafood-sm bg-mafood-background-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-mafood-text-secondary">
      {label}
    </span>
  );
}

/** Selo: Asaas online, pedido+pagamento na tenda, ou só cardápio. */
function Selo({ pdv }: { pdv: PdvCardData }) {
  if (pdvSellsOnline(pdv)) {
    return (
      <span className="inline-flex items-center rounded-mafood-sm bg-mafood-accent-dark px-2 py-0.5 text-[10px] font-semibold text-white shadow-mafood-sm">
        Pedir &amp; pagar aqui
      </span>
    );
  }
  if (pdvPayAtCounter(pdv)) {
    return (
      <span className="inline-flex items-center rounded-mafood-sm bg-mafood-primary-strong px-2 py-0.5 text-[10px] font-semibold text-white shadow-mafood-sm">
        Pedir · pagar na tenda
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-mafood-sm border border-mafood-border px-2 py-0.5 text-[10px] font-semibold text-mafood-text-secondary">
      Cardápio
    </span>
  );
}

export function RestaurantCard({
  venueSlug,
  pdv,
}: {
  venueSlug: string;
  pdv: PdvCardData;
}) {
  const hasRange =
    pdv.price_min != null && pdv.price_max != null && pdv.product_count > 0;
  const priceLabel = hasRange
    ? pdv.price_min === pdv.price_max
      ? brl(pdv.price_min!)
      : `${brl(pdv.price_min!)} – ${brl(pdv.price_max!)}`
    : null;

  const body = (
    <div className="flex h-full flex-col gap-2.5 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-14 place-items-center overflow-hidden rounded-full bg-mafood-background-soft ring-1 ring-mafood-border">
          <PdvLogo logoUrl={pdv.logo_url} size={56} alt={pdv.name} />
        </span>
        <Selo pdv={pdv} />
      </div>

      <h3 className="mafood-restaurant-title text-[15px] leading-tight text-mafood-text-primary line-clamp-2 text-pretty">
        {pdv.name}
      </h3>

      <div className="flex flex-wrap items-center gap-1.5">
        {pdv.category && <CategoryBadge label={pdv.category} />}
        <RestaurantStatus isOpen={pdv.is_open} />
      </div>

      <div className="mt-auto pt-1">
        {priceLabel ? (
          <>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-mafood-text-secondary">
              a partir de
            </span>
            <span className="block truncate text-sm font-semibold text-mafood-primary-strong">
              {priceLabel}
            </span>
          </>
        ) : (
          <span className="block text-[11px] text-mafood-text-secondary">
            {pdv.product_count > 0 ? "Ver cardápio" : "Sem itens ainda"}
          </span>
        )}
      </div>
    </div>
  );

  const shell =
    "flex flex-col rounded-mafood-lg bg-mafood-surface-strong border border-mafood-border shadow-mafood-sm overflow-hidden";

  if (!pdv.is_open) {
    return (
      <Link
        data-pdv-card
        href={`/${venueSlug}/${pdv.slug}`}
        aria-label={`Ver cardápio de ${pdv.name} (fechado)`}
        className={`${shell} opacity-70 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary`}
      >
        {body}
      </Link>
    );
  }

  return (
    <Link
      data-pdv-card
      href={`/${venueSlug}/${pdv.slug}`}
      aria-label={`Abrir ${pdv.name}`}
      className={`${shell} group transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary`}
    >
      {body}
    </Link>
  );
}

export function RestaurantGrid({
  venueSlug,
  pdvs,
}: {
  venueSlug: string;
  pdvs: PdvCardData[];
}) {
  if (pdvs.length === 0) {
    return (
      <EmptyState
        title="Nenhum restaurante por aqui"
        hint="Tente outra categoria ou volte mais tarde."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {pdvs.map((pdv) => (
        <RestaurantCard key={pdv.id} venueSlug={venueSlug} pdv={pdv} />
      ))}
    </div>
  );
}
