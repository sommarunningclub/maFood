"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pills de categoria — filtram o cardápio. A animação do conteúdo
 * fica no MenuView (GSAP).
 */
export function StickyCategoryNavigation({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  /** @deprecated */
  raised?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const sync = () => {
      rafId = 0;
      const slim = document.querySelector<HTMLElement>("[data-slim-header]");
      setTopOffset(slim ? Math.round(slim.getBoundingClientRect().bottom) : 0);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(
      `[data-cat-active="true"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  if (categories.length <= 1) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      style={{ top: topOffset }}
      className="sticky z-20 -mx-4 border-b border-mafood-border/80 bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/85"
    >
      <div className="mx-auto flex max-w-screen-mobile gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar scroll-snap-x lg:max-w-3xl">
        {categories.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              type="button"
              data-cat-active={isActive}
              onClick={() => onSelect(cat)}
              aria-current={isActive ? "true" : undefined}
              className={`snap-start whitespace-nowrap shrink-0 inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
                isActive
                  ? "bg-mafood-primary-strong text-white shadow-mafood-sm"
                  : "border border-mafood-border text-mafood-text-secondary bg-mafood-surface-strong"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
