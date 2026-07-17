"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useCart } from "@/stores/cart-store";
import type { PdvCardData } from "@/components/customer/marketplace-view";

/**
 * Sacola flutuante na home (Praça). Aparece quando há itens e mostra de QUAL
 * restaurante é a sacola — reforçando que se paga um restaurante por vez.
 * Toque leva ao cardápio desse PDV com a sacola (CartSheet) já aberta.
 */
export function HomeCartBar({
  venueSlug,
  pdvs,
}: {
  venueSlug: string;
  pdvs: PdvCardData[];
}) {
  const { count, pdvId, pdvName } = useCart();
  // A store re-hidrata do localStorage de forma síncrona; sem o guard `mounted`
  // o servidor renderiza sem a sacola e o cliente com — erro de hidratação.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const c = count();
  const pdv = pdvId ? pdvs.find((p) => p.id === pdvId) : null;
  const name = pdv?.name ?? pdvName ?? "seu pedido";
  const show = mounted && c > 0 && !!pdv;

  return (
    <AnimatePresence>
      {show && pdv && (
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="pointer-events-none fixed inset-x-0 z-40 bottom-[calc(72px+env(safe-area-inset-bottom)+0.6rem)]"
        >
          <div className="mx-auto max-w-screen-mobile px-4 lg:max-w-3xl">
            <Link
              href={`/${venueSlug}/${pdv.slug}?sacola=1`}
              aria-label={`Ver sacola de ${name}, ${c} ${c === 1 ? "item" : "itens"}`}
              className="pointer-events-auto flex items-center gap-3 rounded-full border border-mafood-border bg-mafood-surface-strong py-2 pl-2 pr-4 shadow-mafood-lg transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary"
            >
              <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-mafood-background-soft">
                <Image
                  src="/training.png"
                  alt=""
                  width={30}
                  height={30}
                  className="pointer-events-none select-none"
                />
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-mafood-primary-strong px-1 text-[11px] font-bold leading-none text-white tabular-nums ring-2 ring-mafood-surface-strong">
                  {c}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] leading-tight text-mafood-text-secondary">
                  Sua sacola · pague um restaurante por vez
                </span>
                <span className="block truncate text-sm font-semibold text-mafood-text-primary">
                  {name}
                </span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-mafood-text-secondary"
                aria-hidden="true"
              />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
