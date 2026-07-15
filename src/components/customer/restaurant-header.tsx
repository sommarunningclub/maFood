"use client";

import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { PdvLogo } from "@/components/pdv-logo";
import type { Pdv } from "@/types";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Cabeçalho do PDV — faixa verde com textura, botão voltar, logo,
 * nome (serif) e status aberto/fechado + meta (tempo de preparo · categoria).
 *
 * Colapsável estilo iFood: o hero alto rola para fora normalmente; uma
 * slim bar fixa (botão voltar + nome do PDV) aparece assim que o hero
 * sai do viewport, detectado via IntersectionObserver numa sentinela no
 * fim do hero.
 */
export function RestaurantHeader({ venue, pdv }: { venue: string; pdv: Pdv }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Slim bar colapsável — some enquanto o hero está visível, aparece
          (fade/slide) assim que o hero rola para fora do viewport. */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            data-slim-header
            className="fixed inset-x-0 top-0 z-40 pt-safe mafood-header-gradient text-white shadow-mafood-sm"
          >
            <div className="flex h-[3.25rem] items-center gap-2 px-2">
              <Link
                href={`/${venue}`}
                aria-label="Voltar"
                className="grid size-11 shrink-0 place-items-center rounded-mafood-md text-white/90 hover:bg-white/10 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
                {pdv.name}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        {/* Sentinela: quando sai do viewport (rola para cima), o hero
            terminou de rolar para fora e a slim bar deve aparecer. */}
        <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      </header>
    </>
  );
}
