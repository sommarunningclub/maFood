"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface PdvHeader {
  slug: string;
  name: string;
  logo_url: string;
  category: string | null;
  instagram_handle: string | null;
  is_open: boolean;
}

const NAV = [
  { href: "pedidos", label: "Pedidos", icon: "▤", hint: "Kanban" },
  { href: "cardapio", label: "Cardápio", icon: "◳", hint: "Produtos" },
  { href: "combos", label: "Combos", icon: "▦", hint: "Combinações" },
  { href: "perfil", label: "Perfil", icon: "◉", hint: "Dados do PDV" },
];

export function PdvSidebar({ pdv }: { pdv: PdvHeader }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/pdv/auth/logout", { method: "POST" });
    router.push(`/loja/${pdv.slug}/login`);
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-palantir-border bg-palantir-surface">
      {/* Header — identidade do PDV */}
      <div className="border-b border-palantir-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{pdv.logo_url || "🍽"}</div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">{pdv.name}</h1>
            <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
              {pdv.category || "PDV"}
            </p>
          </div>
        </div>
        {pdv.instagram_handle && (
          <a
            href={`https://instagram.com/${pdv.instagram_handle}`}
            target="_blank"
            rel="noreferrer"
            className="mono mt-2 inline-block text-[10px] text-palantir-blue hover:underline"
          >
            @{pdv.instagram_handle}
          </a>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-2">
        {NAV.map((item) => {
          const href = `/loja/${pdv.slug}/${item.href}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-3 rounded-admin px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-palantir-blue/15 text-palantir-blue"
                  : "text-palantir-text hover:bg-palantir-surface2"
              }`}
            >
              <span className="mono w-4 text-palantir-muted">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="mono text-[9px] uppercase text-palantir-muted/60">{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status + logout */}
      <div className="border-t border-palantir-border px-4 py-3">
        <p className="mono text-[10px] text-palantir-muted">PDV</p>
        <p className={`mono text-[10px] ${pdv.is_open ? "text-palantir-green" : "text-palantir-red"}`}>
          ● {pdv.is_open ? "ABERTO" : "FECHADO"}
        </p>
        <button
          onClick={logout}
          disabled={loggingOut}
          className="mono mt-3 w-full rounded-admin border border-palantir-border px-2 py-1.5 text-[10px] uppercase text-palantir-muted hover:border-palantir-red hover:text-palantir-red disabled:opacity-40"
        >
          {loggingOut ? "..." : "↩ Sair"}
        </button>
      </div>
    </aside>
  );
}
