"use client";

import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { PdvLogo } from "@/components/pdv-logo";
import type { Pdv } from "@/types";

/**
 * Cabeçalho do PDV — faixa verde com textura, botão voltar, logo,
 * nome (serif) e status aberto/fechado + meta (tempo de preparo · categoria).
 */
export function RestaurantHeader({ venue, pdv }: { venue: string; pdv: Pdv }) {
  return (
    <header className="mafood-header-gradient pt-safe text-white">
      <div className="px-4 pb-6 pt-3">
        <div className="flex items-center">
          <Link
            href={`/${venue}`}
            aria-label="Voltar"
            className="grid size-11 -ml-2 shrink-0 place-items-center rounded-mafood-md text-white/90 hover:bg-white/10 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ArrowLeft className="size-5" />
          </Link>
        </div>

        <div className="mt-3 flex items-end gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-mafood-lg bg-white/12 ring-1 ring-white/25 shadow-mafood-sm">
            <PdvLogo logoUrl={pdv.logo_url} size={64} alt={pdv.name} />
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="mafood-restaurant-title text-fluid-2xl leading-tight text-white text-balance">
              {pdv.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  pdv.is_open
                    ? "bg-white/15 text-white"
                    : "bg-black/25 text-white/85"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    pdv.is_open ? "bg-mafood-success-bright" : "bg-white/60"
                  }`}
                  aria-hidden="true"
                />
                {pdv.is_open ? "Aberto agora" : "Fechado"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-white/85">
                <Clock className="size-3.5" aria-hidden="true" />
                {pdv.prep_time_min} min
              </span>
              {pdv.category && (
                <span className="text-[13px] text-white/85">· {pdv.category}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
