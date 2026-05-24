"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  UtensilsCrossed,
  Layers,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PdvHeader {
  slug: string;
  name: string;
  logo_url: string;
  category: string | null;
  instagram_handle: string | null;
  is_open: boolean;
}

const NAV = [
  { href: "pedidos", label: "Pedidos", Icon: ClipboardList, hint: "Kanban" },
  { href: "cardapio", label: "Cardápio", Icon: UtensilsCrossed, hint: "Produtos" },
  { href: "combos", label: "Combos", Icon: Layers, hint: "Combinações" },
  { href: "perfil", label: "Perfil", Icon: User, hint: "Dados do PDV" },
];

export function PdvSidebar({ pdv }: { pdv: PdvHeader }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/pdv/auth/logout", { method: "POST" });
    router.push(`/loja/${pdv.slug}/login`);
  }

  const isActive = (href: string) => pathname?.startsWith(`/loja/${pdv.slug}/${href}`);

  const SidebarContent = (
    <>
      {/* Header — identidade do PDV */}
      <div className="border-b border-palantir-border px-4 sm:px-5 py-4">
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
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Menu do PDV">
        {NAV.map((item) => {
          const href = `/loja/${pdv.slug}/${item.href}`;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex min-h-touch items-center gap-3 rounded-admin px-3 py-2.5 text-sm transition-colors focus-ring-admin",
                active
                  ? "bg-palantir-blue/15 text-palantir-blue"
                  : "text-palantir-text hover:bg-palantir-surface2"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-palantir-blue" : "text-palantir-muted"
                )}
              />
              <span className="flex-1">{item.label}</span>
              <span className="mono text-[9px] uppercase text-palantir-muted/60">{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-palantir-border px-4 py-3 pb-safe">
        <p className="mono text-[10px] text-palantir-muted">PDV</p>
        <p
          className={`mono text-[10px] ${
            pdv.is_open ? "text-palantir-green" : "text-palantir-red"
          }`}
        >
          ● {pdv.is_open ? "ABERTO" : "FECHADO"}
        </p>
        <button
          onClick={logout}
          disabled={loggingOut}
          className="mono mt-3 inline-flex w-full items-center justify-center gap-2 min-h-touch rounded-admin border border-palantir-border px-2 text-[10px] uppercase text-palantir-muted hover:border-palantir-red hover:text-palantir-red disabled:opacity-40 focus-ring-admin"
        >
          <LogOut className="size-3.5" />
          {loggingOut ? "..." : "Sair"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ─── Sidebar md+ ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-palantir-border bg-palantir-surface">
        {SidebarContent}
      </aside>

      {/* ─── Top bar mobile (<md) ─────────────────────────────── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-2 border-b border-palantir-border bg-palantir-surface/95 backdrop-blur px-3 py-2 pt-safe">
        <button
          onClick={() => setDrawerOpen(true)}
          className="grid size-touch place-items-center rounded-admin text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-lg shrink-0">{pdv.logo_url || "🍽"}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{pdv.name}</p>
            <p
              className={`mono text-[9px] uppercase ${
                pdv.is_open ? "text-palantir-green" : "text-palantir-red"
              }`}
            >
              ● {pdv.is_open ? "Aberto" : "Fechado"}
            </p>
          </div>
        </div>
        <div className="size-touch" />
      </header>

      {/* ─── Drawer mobile ────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <button
            aria-label="Fechar menu"
            className="md:hidden fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu do PDV"
            className="md:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-palantir-border bg-palantir-surface animate-slide-in-right pl-safe"
          >
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setDrawerOpen(false)}
                className="grid size-touch place-items-center text-palantir-muted hover:text-white focus-ring-admin"
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </button>
            </div>
            {SidebarContent}
          </aside>
        </>
      )}

      {/* ─── Bottom nav mobile (always visible) ───────────────── */}
      <nav
        aria-label="Navegação rápida"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-palantir-border bg-palantir-surface/95 backdrop-blur pb-safe"
      >
        {NAV.map((item) => {
          const href = `/loja/${pdv.slug}/${item.href}`;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 min-h-touch py-1.5 text-[10px] font-medium focus-ring-admin",
                active ? "text-palantir-blue" : "text-palantir-muted"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.Icon className="size-5" />
              <span className="uppercase tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
