"use client";

import { useEffect, useRef, useState } from "react";
import { categoryAnchorId } from "@/lib/utils";

/**
 * Navegação de categorias — pills horizontais sticky no TOPO (abaixo da
 * slim bar do cabeçalho quando ela está visível). Clicar rola até a seção
 * e um IntersectionObserver mantém o pill ativo em sincronia.
 */
export function StickyCategoryNavigation({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  /** @deprecated Mantido por compatibilidade — chrome inferior não usa mais. */
  raised?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const onSelectRef = useRef(onSelect);
  const clickLockRef = useRef(0);
  const [topOffset, setTopOffset] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Acompanha a slim bar fixa para grudar as pills logo abaixo dela.
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
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(categoryAnchorId(c)))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    let observer: IntersectionObserver | null = null;
    let lastTop = -1;
    let rafId = 0;

    const createObserver = (headerOffset: number) => {
      lastTop = headerOffset;
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          if (Date.now() < clickLockRef.current) return;
          const visibleSecs = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const id = visibleSecs[0]?.target.id;
          if (!id) return;
          const cat = categories.find((c) => categoryAnchorId(c) === id);
          if (cat) onSelectRef.current(cat);
        },
        { rootMargin: `-${headerOffset + 48}px 0px -55% 0px`, threshold: 0 }
      );
      sections.forEach((s) => observer?.observe(s));
    };

    const syncOffset = () => {
      const slim = document.querySelector<HTMLElement>("[data-slim-header]");
      const navH = navRef.current?.offsetHeight ?? 48;
      const headerOffset = Math.round(
        (slim?.getBoundingClientRect().bottom ?? 0) + navH
      );
      if (observer && Math.abs(headerOffset - lastTop) <= 2) return;
      createObserver(headerOffset);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        syncOffset();
      });
    };

    syncOffset();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncOffset);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncOffset);
      observer?.disconnect();
    };
  }, [categories]);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>(
      `[data-cat-active="true"]`
    );
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  if (categories.length <= 1) return null;

  function handleClick(cat: string) {
    clickLockRef.current = Date.now() + 700;
    onSelect(cat);
    document
      .getElementById(categoryAnchorId(cat))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      style={{ top: topOffset }}
      className="sticky z-20 -mx-4 border-b border-mafood-border/80 bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/85 transition-[top] duration-150"
    >
      <div className="mx-auto flex max-w-screen-mobile gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar scroll-snap-x">
        {categories.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              type="button"
              data-cat-active={isActive}
              onClick={() => handleClick(cat)}
              aria-current={isActive ? "true" : undefined}
              className={`snap-start whitespace-nowrap shrink-0 inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
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
