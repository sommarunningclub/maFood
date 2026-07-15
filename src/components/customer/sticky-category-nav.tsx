"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Navegação de categorias — pills horizontais numa barra FIXA na base da
 * tela. Aparece assim que o usuário rola para baixo (sai do topo do hero) e
 * some perto do topo, para não competir com o cabeçalho. Clicar rola
 * suavemente até a seção `#<cat>` e sincroniza o pill ativo; um
 * IntersectionObserver mantém o ativo em sincronia conforme o usuário rola.
 *
 * `raised` sobe a barra para acima da barra flutuante do carrinho quando ela
 * está visível, evitando sobreposição.
 */
export function StickyCategoryNavigation({
  categories,
  active,
  onSelect,
  raised = false,
}: {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  raised?: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const onSelectRef = useRef(onSelect);
  const clickLockRef = useRef(0);
  // A barra só aparece depois que o usuário rola para baixo (passa do hero).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Mostra/esconde a barra conforme a rolagem. Threshold ~ altura do hero;
  // acima disso (topo da página) a barra fica escondida.
  useEffect(() => {
    let rafId = 0;
    const SHOW_AT = 140; // px rolados a partir do topo
    const evaluate = () => {
      rafId = 0;
      setVisible(window.scrollY > SHOW_AT);
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(evaluate);
    };
    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Sincroniza o pill ativo enquanto o usuário rola a lista de seções.
  // Para uma barra na BASE, o offset relevante é o topo do conteúdo visível
  // (logo abaixo da slim bar colapsável do cabeçalho). Medimos a slim bar
  // real (`[data-slim-header]`) para cobrir safe-area-inset-top + altura,
  // com fallback constante quando ela ainda não está montada.
  useEffect(() => {
    if (categories.length === 0) return;
    const sections = categories
      .map((c) => document.getElementById(c))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    let observer: IntersectionObserver | null = null;
    let lastTop = -1;
    let rafId = 0;

    const createObserver = (topOffset: number) => {
      lastTop = topOffset;
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          if (Date.now() < clickLockRef.current) return;
          const visibleSecs = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visibleSecs[0]?.target.id)
            onSelectRef.current(visibleSecs[0].target.id);
        },
        { rootMargin: `-${topOffset}px 0px -55% 0px`, threshold: 0 }
      );
      sections.forEach((s) => observer?.observe(s));
    };

    const syncOffset = () => {
      const slim = document.querySelector<HTMLElement>("[data-slim-header]");
      const topOffset = Math.round(
        slim?.getBoundingClientRect().bottom ?? 64
      );
      if (observer && Math.abs(topOffset - lastTop) <= 2) return;
      createObserver(topOffset);
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
      className={`fixed inset-x-0 z-20 border-t border-mafood-border bg-mafood-background/95 backdrop-blur supports-[backdrop-filter]:bg-mafood-background/80 transition-[transform,opacity] duration-200 ${
        raised
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
          : "bottom-0 pb-safe"
      } ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      }`}
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
