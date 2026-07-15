"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { X, Store, ClipboardList, User, LogOut } from "lucide-react";

export function MaFoodMenuDrawer({
  open,
  onClose,
  venueSlug,
}: {
  open: boolean;
  onClose: () => void;
  venueSlug: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const onCloseRef = useRef(onClose);
  const startX = useRef(0);
  const currentDX = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>("a,button");
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener.current?.focus();
      if (panelRef.current) {
        panelRef.current.style.transform = "";
        panelRef.current.style.transition = "";
      }
    };
  }, [open]);

  if (!open) return null;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    currentDX.current = 0;
    dragging.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current || !panelRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx >= 0) {
      currentDX.current = 0;
      if (panelRef.current) panelRef.current.style.transform = "";
      return;
    }
    const panelWidth = panelRef.current.offsetWidth || 1;
    currentDX.current = Math.max(dx, -panelWidth);
    panelRef.current.style.transform = `translateX(${currentDX.current}px)`;
  }

  function onTouchEnd() {
    dragging.current = false;
    if (!panelRef.current) return;
    if (currentDX.current < -80) {
      onClose();
      return;
    }
    if (!prefersReducedMotion) {
      panelRef.current.style.transition = "transform 0.2s ease-out";
    }
    panelRef.current.style.transform = "";
    if (!prefersReducedMotion) {
      window.setTimeout(() => {
        if (panelRef.current) panelRef.current.style.transition = "";
      }, 200);
    }
    currentDX.current = 0;
  }

  const items = [
    { href: `/${venueSlug}`, label: "Restaurantes", icon: Store },
    { href: `/${venueSlug}/history`, label: "Meus pedidos", icon: ClipboardList },
    { href: `/${venueSlug}/account`, label: "Minha conta", icon: User },
  ];

  async function handleLogout() {
    onClose();
    await fetch("/api/customer/logout", { method: "POST" });
    router.push(`/${venueSlug}/login`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 w-[82%] max-w-xs bg-mafood-surface-strong shadow-mafood-lg flex flex-col pt-safe animate-slide-in-left"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="mafood-header-gradient px-5 py-5 flex items-center justify-between text-white">
          <span className="mafood-display text-lg">SommaFood</span>
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="grid size-touch place-items-center rounded-mafood-md bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 p-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose}
              className="flex items-center gap-3 px-3 h-12 rounded-mafood-md text-mafood-text-primary hover:bg-mafood-background-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary">
              <Icon className="size-5 text-mafood-primary-strong" />
              <span className="text-[15px]">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-mafood-border pb-safe">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 h-12 w-full rounded-mafood-md text-mafood-accent-dark hover:bg-mafood-background-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-accent"
          >
            <LogOut className="size-5" />
            <span className="text-[15px]">Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}
