"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/**
 * Sacola flutuante em bolinha (FAB), canto inferior direito.
 * Bolinha branca com a ilustração `training.png` e badge de contador.
 * Toque abre o CartSheet. Renderizada dentro de <AnimatePresence> pelo pai.
 */
export function CartFab({
  count,
  navVisible,
  onClick,
}: {
  count: number;
  /** Sobe a bolinha para flutuar acima da barra de categorias */
  navVisible: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={`Ver sacola, ${count} ${count === 1 ? "item" : "itens"}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 480, damping: 26 }}
      className={`fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-mafood-surface-strong shadow-mafood-lg ring-1 ring-mafood-border transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
        navVisible
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom)+0.75rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
      }`}
    >
      <Image
        src="/training.png"
        alt=""
        width={38}
        height={38}
        className="pointer-events-none select-none"
        priority
      />
      <motion.span
        key={count}
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-mafood-primary-strong px-1 text-[11px] font-bold leading-none text-white tabular-nums ring-2 ring-mafood-surface-strong"
      >
        {count}
      </motion.span>
    </motion.button>
  );
}
