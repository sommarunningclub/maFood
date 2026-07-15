"use client";

import Link from "next/link";
import { Store, ClipboardList, User } from "lucide-react";

/**
 * Rodapé em card verde. Somente links reais do app:
 * Restaurantes, Meus pedidos, Conta. Sem redes sociais inventadas.
 */
export function MaFoodFooter({ venueSlug }: { venueSlug: string }) {
  const links = [
    { href: `/${venueSlug}`, label: "Restaurantes", icon: Store },
    { href: `/${venueSlug}/history`, label: "Meus pedidos", icon: ClipboardList },
    { href: `/${venueSlug}/account`, label: "Conta", icon: User },
  ];

  return (
    <footer className="mt-10 px-4">
      <div className="mafood-header-gradient rounded-mafood-xl px-5 py-7 text-white shadow-mafood-md">
        <span className="mafood-display text-xl tracking-tight">SommaFood</span>
        <p className="mt-1 text-sm text-white/75 text-pretty">
          Peça dos restaurantes do evento, num só lugar.
        </p>

        <nav className="mt-5 grid gap-1" aria-label="Navegação do rodapé">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 h-11 rounded-mafood-md px-3 -mx-3 text-[15px] text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors"
            >
              <Icon className="size-4 shrink-0 text-white/70" />
              {label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 border-t border-white/15 pt-4 text-[11px] text-white/55">
          © {new Date().getFullYear()} SommaFood
        </p>
      </div>
    </footer>
  );
}
