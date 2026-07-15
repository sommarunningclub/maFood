"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Home, ShoppingBag, UtensilsCrossed, User } from "lucide-react";

const LAST_PDV_KEY = "mafood-last-pdv";

type NavItem = {
  label: string;
  icon: React.ElementType<{ className?: string }>;
  href: (venue: string, lastPdv: string | null) => string;
  match: (segments: string[]) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Praça",
    icon: Home,
    href: (v) => `/${v}`,
    match: (s) => s.length === 1,
  },
  {
    label: "Cardápio",
    icon: UtensilsCrossed,
    href: (v, lastPdv) => (lastPdv ? `/${v}/${lastPdv}` : `/${v}`),
    match: (s) =>
      s.length === 2 &&
      !["checkout", "history", "login", "order", "account"].includes(s[1] ?? ""),
  },
  {
    label: "Pedidos",
    icon: ShoppingBag,
    href: (v) => `/${v}/history`,
    match: (s) => s[1] === "history",
  },
  {
    label: "Conta",
    icon: User,
    href: (v) => `/${v}/account`,
    match: (s) => s[1] === "account",
  },
];

const HIDDEN_SEGMENTS = ["checkout", "login", "order"];

function shouldHideNav(segments: string[]): boolean {
  const venue = segments[0] ?? "";
  const second = segments[1] ?? "";
  const isPdvMenu =
    segments.length === 2 &&
    !["checkout", "history", "login", "order", "account"].includes(second);
  return !venue || HIDDEN_SEGMENTS.includes(second) || isPdvMenu || segments.length === 0;
}

/** Persiste o último PDV visitado para o atalho "Cardápio" na bottom nav. */
export function rememberLastPdv(venue: string, pdvSlug: string) {
  try {
    sessionStorage.setItem(`${LAST_PDV_KEY}:${venue}`, pdvSlug);
  } catch {
    /* private mode */
  }
}

function readLastPdv(venue: string): string | null {
  try {
    return sessionStorage.getItem(`${LAST_PDV_KEY}:${venue}`);
  } catch {
    return null;
  }
}

/**
 * Bottom nav + chrome. Retorna null em rotas onde o rodapé não deve
 * aparecer (cardápio do PDV, checkout, login, tracker) — assim não sobra
 * faixa vazia nem padding fantasma.
 */
export function CustomerBottomNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const venue = segments[0] ?? "";

  if (shouldHideNav(segments)) return null;

  return <NavChrome venue={venue} segments={segments} />;
}

function NavChrome({
  venue,
  segments,
}: {
  venue: string;
  segments: string[];
}) {
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [lastPdv, setLastPdv] = useState<string | null>(null);

  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(segments));

  useEffect(() => {
    setLastPdv(readLastPdv(venue));
  }, [venue, segments]);

  useEffect(() => {
    const update = () => {
      const el = itemRefs.current[activeIndex];
      const text = textRefs.current[activeIndex];
      if (el && text) {
        el.style.setProperty("--lineWidth", `${text.offsetWidth}px`);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeIndex]);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-screen-mobile lg:max-w-3xl bg-mafood-surface-strong/95 backdrop-blur border-t border-mafood-border pb-safe">
      <nav
        className="menu"
        style={
          {
            "--component-active-color": "var(--mafood-primary-strong)",
          } as React.CSSProperties
        }
      >
        {NAV_ITEMS.map((item, i) => {
          const isActive = i === activeIndex;
          const Icon = item.icon;
          const href = item.href(venue, lastPdv);

          return (
            <Link
              key={item.label}
              href={href}
              prefetch
              className={`menu__item active:scale-95 transition-transform ${isActive ? "active" : ""}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              style={{ "--lineWidth": "0px" } as React.CSSProperties}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="menu__icon">
                <Icon className="icon" />
              </div>
              <strong
                className={`menu__text ${isActive ? "active" : ""}`}
                ref={(el) => {
                  textRefs.current[i] = el;
                }}
              >
                {item.label}
              </strong>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Padding inferior só quando a bottom nav está visível. */
export function CustomerMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const navVisible = !shouldHideNav(segments);

  return (
    <div
      className={`mx-auto w-full max-w-screen-mobile lg:max-w-3xl flex-1 ${
        navVisible ? "pb-[calc(72px+env(safe-area-inset-bottom))]" : ""
      }`}
    >
      {children}
    </div>
  );
}
