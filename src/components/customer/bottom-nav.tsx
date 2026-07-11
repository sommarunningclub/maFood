"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Home, ShoppingBag, UtensilsCrossed, User } from "lucide-react";

type NavItem = {
  label: string;
  icon: React.ElementType<{ className?: string }>;
  href: (venue: string) => string;
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
    href: (v) => `/${v}`,
    // active when on a PDV page (3rd segment exists and isn't reserved)
    match: (s) =>
      s.length === 2 &&
      !["checkout", "history", "login", "order"].includes(s[1] ?? ""),
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

// Routes where the nav should be hidden
const HIDDEN_SEGMENTS = ["checkout", "login", "order"];

export function CustomerBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split("/").filter(Boolean);
  const venue = segments[0] ?? "";

  // Hide on checkout, login, order tracker, root page, and PDV menu (floating cart bar owns the bottom there)
  const second = segments[1] ?? "";
  const isPdvMenu =
    segments.length === 2 &&
    !["checkout", "history", "login", "order", "account"].includes(second);
  if (!venue || HIDDEN_SEGMENTS.includes(second) || isPdvMenu || segments.length === 0) {
    return null;
  }

  return <NavInner venue={venue} segments={segments} router={router} />;
}

function NavInner({
  venue,
  segments,
  router,
}: {
  venue: string;
  segments: string[];
  router: ReturnType<typeof useRouter>;
}) {
  const textRefs = useRef<(HTMLElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIndex = NAV_ITEMS.findIndex((item) => item.match(segments));

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

  function handleClick(href: string) {
    router.push(href);
  }

  return (
    <nav
      className="menu"
      style={{ "--component-active-color": "var(--mafood-primary-strong)" } as React.CSSProperties}
    >
      {NAV_ITEMS.map((item, i) => {
        const isActive = i === activeIndex;
        const Icon = item.icon;
        const href = item.href(venue);

        return (
          <button
            key={item.label}
            className={`menu__item ${isActive ? "active" : ""}`}
            onClick={() => handleClick(href)}
            ref={(el) => { itemRefs.current[i] = el; }}
            style={{ "--lineWidth": "0px" } as React.CSSProperties}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="menu__icon">
              <Icon className="icon" />
            </div>
            <strong
              className={`menu__text ${isActive ? "active" : ""}`}
              ref={(el) => { textRefs.current[i] = el; }}
            >
              {item.label}
            </strong>
          </button>
        );
      })}
    </nav>
  );
}
