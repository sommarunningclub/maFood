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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PdvLogo } from "@/components/pdv-logo";

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

const COLLAPSE_KEY = "mafood_pdv_sidebar_collapsed";

export function PdvSidebar({ pdv }: { pdv: PdvHeader }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Restaura estado do collapse (só desktop)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/pdv/auth/logout", { method: "POST" });
    router.push(`/loja/${pdv.slug}/login`);
  }

  const isActive = (href: string) => pathname?.startsWith(`/loja/${pdv.slug}/${href}`);

  return (
    <>
      {/* ─── Sidebar md+ ─────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-r border-palantir-border bg-palantir-surface transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <SidebarBody
          pdv={pdv}
          isActive={isActive}
          loggingOut={loggingOut}
          onLogout={logout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
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
          <PdvLogo logoUrl={pdv.logo_url} size={24} />
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
            <SidebarBody
              pdv={pdv}
              isActive={isActive}
              loggingOut={loggingOut}
              onLogout={logout}
              collapsed={false}
            />
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

function SidebarBody({
  pdv,
  isActive,
  loggingOut,
  onLogout,
  collapsed,
  onToggleCollapse,
}: {
  pdv: PdvHeader;
  isActive: (href: string) => boolean | undefined;
  loggingOut: boolean;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Header — identidade do PDV */}
      <div
        className={cn(
          "relative border-b border-palantir-border",
          collapsed ? "px-2 py-3" : "px-4 sm:px-5 py-4"
        )}
      >
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <div title={collapsed ? pdv.name : undefined}>
            <PdvLogo logoUrl={pdv.logo_url} size={32} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-white">{pdv.name}</h1>
              <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                {pdv.category || "PDV"}
              </p>
            </div>
          )}
        </div>
        {!collapsed && pdv.instagram_handle && (
          <a
            href={`https://instagram.com/${pdv.instagram_handle}`}
            target="_blank"
            rel="noreferrer"
            className="mono mt-2 inline-block text-[10px] text-palantir-blue hover:underline"
          >
            @{pdv.instagram_handle}
          </a>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir" : "Recolher"}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full border border-palantir-border bg-palantir-bg text-palantir-muted hover:text-white hover:border-palantir-blue/60 focus-ring-admin shadow-sm",
              collapsed ? "-right-3" : "-right-3"
            )}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Navegação */}
      <nav
        className={cn("flex-1 overflow-y-auto", collapsed ? "p-1.5" : "p-2")}
        aria-label="Menu do PDV"
      >
        {NAV.map((item) => {
          const href = `/loja/${pdv.slug}/${item.href}`;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex min-h-touch items-center rounded-admin transition-colors focus-ring-admin",
                collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2.5 text-sm",
                active
                  ? "bg-palantir-blue/15 text-palantir-blue"
                  : "text-palantir-text hover:bg-palantir-surface2"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              <item.Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-palantir-blue" : "text-palantir-muted"
                )}
              />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  <span className="mono text-[9px] uppercase text-palantir-muted/60">
                    {item.hint}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "border-t border-palantir-border pb-safe",
          collapsed ? "p-2 flex flex-col items-center gap-2" : "px-4 py-3"
        )}
      >
        {collapsed ? (
          <>
            <span
              className={cn(
                "block size-2 rounded-full",
                pdv.is_open ? "bg-palantir-green" : "bg-palantir-red"
              )}
              title={pdv.is_open ? "PDV aberto" : "PDV fechado"}
            />
            <button
              onClick={onLogout}
              disabled={loggingOut}
              aria-label="Sair"
              title="Sair"
              className="grid size-9 place-items-center rounded-admin border border-palantir-border text-palantir-muted hover:border-palantir-red hover:text-palantir-red disabled:opacity-40 focus-ring-admin"
            >
              <LogOut className="size-4" />
            </button>
          </>
        ) : (
          <>
            <p className="mono text-[10px] text-palantir-muted">PDV</p>
            <p
              className={`mono text-[10px] ${
                pdv.is_open ? "text-palantir-green" : "text-palantir-red"
              }`}
            >
              ● {pdv.is_open ? "ABERTO" : "FECHADO"}
            </p>
            <button
              onClick={onLogout}
              disabled={loggingOut}
              className="mono mt-3 inline-flex w-full items-center justify-center gap-2 min-h-touch rounded-admin border border-palantir-border px-2 text-[10px] uppercase text-palantir-muted hover:border-palantir-red hover:text-palantir-red disabled:opacity-40 focus-ring-admin"
            >
              <LogOut className="size-3.5" />
              {loggingOut ? "..." : "Sair"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
