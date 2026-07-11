"use client";

import { useEffect, useRef } from "react";

/**
 * Navegação de categorias — pills horizontais, fixa (sticky) logo abaixo
 * do cabeçalho. Clicar rola suavemente até a seção `#<cat>` e sincroniza
 * o pill ativo. Um IntersectionObserver mantém o ativo em sincronia
 * conforme o usuário rola.
 */
export function StickyCategoryNavigation({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
}) {
  const navRef = useRef<HTMLElement>(null);
  const onSelectRef = useRef(onSelect);
  const clickLockRef = useRef(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Sincroniza o pill ativo enquanto o usuário rola a lista de seções.
  // O rootMargin é calculado dinamicamente a partir da posição real da nav
  // (getBoundingClientRect().bottom), o que cobre automaticamente a altura
  // da slim bar colapsável + safe-area-inset-top + altura da própria nav,
  // sem números mágicos fixos.
  //
  // Importante: no mount (scrollY=0) a nav ainda NÃO está pinada — ela fica
  // no fluxo, logo abaixo do hero alto (~150px), então bottom vem inflado.
  // Por isso remedimos a posição real da nav no scroll (throttlado com rAF)
  // e só recriamos o observer quando o valor muda >2px. Assim que a nav
  // estabiliza na posição dockada (~110px), o valor para de mudar e o
  // observer deixa de ser recriado (sem churn).
  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(c))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    let observer: IntersectionObserver | null = null;
    let lastNavBottom = -1;
    let rafId = 0;

    const createObserver = (navBottom: number) => {
      lastNavBottom = navBottom;
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          // Ignora atualizações logo após um clique (o scroll suave dispara
          // várias interseções que sobrescreveriam a seleção do usuário).
          if (Date.now() < clickLockRef.current) return;
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
            );
          if (visible[0]?.target.id) onSelectRef.current(visible[0].target.id);
        },
        { rootMargin: `-${navBottom}px 0px -60% 0px`, threshold: 0 }
      );
      sections.forEach((s) => observer?.observe(s));
    };

    // Remede a posição real da nav e recria o observer só se mudou o bastante.
    const syncOffset = () => {
      const navBottom = Math.round(
        navRef.current?.getBoundingClientRect().bottom ?? 96
      );
      if (observer && Math.abs(navBottom - lastNavBottom) <= 2) return;
      createObserver(navBottom);
    };

    // Scroll throttlado com requestAnimationFrame.
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

  // Mantém o pill ativo visível na faixa rolável.
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
      .getElementById(cat)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-20 border-b border-mafood-border bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/80"
    >
      <div className="flex gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar scroll-snap-x">
        {categories.map((cat) => {
          const isActive = active === cat;
          return (
            <button
              key={cat}
              type="button"
              data-cat-active={isActive}
              onClick={() => handleClick(cat)}
              aria-current={isActive ? "true" : undefined}
              className={`snap-start whitespace-nowrap shrink-0 inline-flex min-h-[38px] items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mafood-primary ${
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
