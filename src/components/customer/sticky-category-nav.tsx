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
  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(c))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Ignora atualizações logo após um clique (o scroll suave dispara
        // várias interseções que sobrescreveriam a seleção do usuário).
        if (Date.now() < clickLockRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) onSelectRef.current(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -68% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
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
      className="sticky top-0 z-20 border-b border-mafood-border bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/80"
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
                  ? "bg-mafood-primary text-white shadow-mafood-sm"
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
