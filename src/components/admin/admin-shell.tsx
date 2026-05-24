"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ScrollText,
  Store,
  Package,
  Percent,
  DollarSign,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pedidos", Icon: ScrollText },
  { href: "/admin/pdvs", label: "PDVs", Icon: Store },
  { href: "/admin/products", label: "Produtos", Icon: Package },
  { href: "/admin/coupons", label: "Cupons", Icon: Percent },
  { href: "/admin/financial", label: "Financeiro", Icon: DollarSign },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha drawer ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava scroll do body quando drawer aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC fecha drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="theme-admin flex min-h-dvh-100">
      {/* ─── Sidebar desktop (lg+) ───────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-palantir-border bg-palantir-surface">
        <SidebarBrand />
        <SidebarNav isActive={isActive} />
        <SidebarFooter />
      </aside>

      {/* ─── Drawer mobile/tablet (<lg) ──────────────────────── */}
      {open && (
        <>
          <button
            aria-label="Fechar menu"
            className="lg:hidden fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="lg:hidden fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-palantir-border bg-palantir-surface animate-slide-in-right pl-safe"
          >
            <div className="flex items-center justify-between border-b border-palantir-border px-5 py-4">
              <div>
                <h1 className="text-lg font-bold text-white">maFood</h1>
                <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
                  Backoffice
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid size-touch place-items-center text-palantir-muted hover:text-white focus-ring-admin"
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav isActive={isActive} />
            <SidebarFooter />
          </aside>
        </>
      )}

      {/* ─── Main ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar mobile/tablet — sticky com botão hamburger */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-palantir-border bg-palantir-surface/95 backdrop-blur px-3 py-2 pt-safe">
          <button
            onClick={() => setOpen(true)}
            className="grid size-touch place-items-center rounded-admin text-palantir-text hover:bg-palantir-surface2 focus-ring-admin"
            aria-label="Abrir menu"
            aria-expanded={open}
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-white">maFood</span>
            <span className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
              Backoffice
            </span>
          </div>
        </header>

        <main className="palantir-grid flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="border-b border-palantir-border px-5 py-4">
      <h1 className="text-lg font-bold text-white">maFood</h1>
      <p className="mono text-[10px] uppercase tracking-wider text-palantir-muted">
        Backoffice
      </p>
    </div>
  );
}

function SidebarNav({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Menu principal">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-touch items-center gap-3 rounded-admin px-3 py-2.5 text-sm transition-colors focus-ring-admin",
              active
                ? "bg-palantir-surface2 text-white"
                : "text-palantir-text hover:bg-palantir-surface2"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-palantir-blue" : "text-palantir-muted"
              )}
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-palantir-border px-5 py-3 pb-safe">
      <p className="mono text-[10px] text-palantir-muted">Somma Special Day</p>
      <p className="mono text-[10px] text-palantir-green">● ONLINE</p>
    </div>
  );
}
