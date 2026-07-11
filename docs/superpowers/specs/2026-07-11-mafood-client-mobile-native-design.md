# maFood Client — Revisão 360 Mobile / Native-App Feel

**Data:** 2026-07-11
**Branch:** redesign/mafood-client
**Objetivo:** Deixar toda a experiência mobile do cliente maFood com sensação de app nativo — header fixo, sem zoom acidental, safe-areas corretas, touch UX perfeita. Referência de UX: **iFood**.

## Decisões-chave

- **Zoom:** manter `userScalable: true` / `maximumScale: 5` (acessibilidade WCAG 1.4.4). "Sem zoom" = eliminar as *causas* de zoom acidental, não travar o gesto. Principal causa: inputs `<16px`.
- **Escopo:** todas as telas do cliente (`src/app/(client)/[venue]/*` e `src/components/customer/*`).
- **Sem regressão de acessibilidade:** todas as correções preservam contraste AA já conquistado, focus rings e reduced-motion existentes.

## Escopo e não-escopo

**No escopo:** rotas `(client)` e componentes `customer/`, `src/app/layout.tsx` (viewport/fonts/theme-color só na medida em que afeta o cliente), `globals.css`, `tailwind.config.ts`.

**Fora de escopo:** admin, PDV operador, pay, landing. Refactors não relacionados. Nenhuma mudança de lógica de negócio/ordem além de UX.

---

## Fase 1 — Fundamentos globais

**Arquivos:** `src/app/layout.tsx`, `src/app/(client)/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `src/lib/fonts.ts`.

1. **Anti-zoom iOS (raiz):** regra global CSS `input, select, textarea { font-size: 16px }` (com override permitido só para tamanho *visual* via transform, nunca `<16px` no elemento focável). **Remover** o opt-out em `globals.css:49-55` que reintroduz `font-size: inherit` em inputs `.text-xs/.text-[11px]/[12px]/[13px]`.
2. **Status bar / theme-color:** para o cliente (creme `#faf3ea`), usar `statusBarStyle: "default"` e `themeColor` claro. Se necessário sem afetar admin, mover a config para o route group `(client)` (metadata/viewport próprios) ou ajustar global com media adequada.
3. **Bottom-nav vs safe-area:** trocar reserva fixa `pb-[72px]` por `pb-[calc(72px+env(safe-area-inset-bottom))]` no wrapper de conteúdo (`(client)/layout.tsx:9`). Manter `pb-safe` na nav.
4. **Body background creme no cliente:** garantir que a shell `(client)` pinte fundo creme (sem bleed do `#080808` do body root no overscroll/transição).
5. **overflow-x:** mover `overflow-x:hidden` de `html` para `body` (evita quebrar `position:sticky`); corrigir overflows reais em vez de mascarar.
6. **Fontes escopadas:** carregar Inter/JetBrains/Barlow/Plex apenas no tree admin; cliente carrega só Merriweather + DM Sans.
7. **Tap-highlight & pressed states:** confirmar `-webkit-tap-highlight-color: transparent` global; adicionar utilitário/estado `active:` (scale/opacity) reutilizável.
8. **touch-action:** `manipulation` também nas superfícies de conteúdo interativas (cards/listas), não só em `a/button`.

**Verificação:** DevTools mobile (iPhone SE 320px, iPhone 14 Pro 393px c/ notch, Pixel 7). Focar cada input → sem zoom. Safe-area visível (simular inset). Sem scroll horizontal em nenhuma tela.

---

## Fase 2 — Header fixo + navegação

**Arquivos:** `restaurant-header.tsx`, `sticky-category-nav.tsx`, `menu-view.tsx`, `bottom-nav.tsx`, `mafood-menu-drawer.tsx`, `mafood-search.tsx`, `globals.css`.

1. **Header do restaurante fixo:** `restaurant-header.tsx:14` → `sticky top-0 z-40`. Padrão iFood: hero pode ter altura maior que colapsa para uma barra slim persistente com voltar + título. Mínimo aceitável: header inteiro sticky com botão voltar sempre visível.
2. **Sticky category nav docando sob o header:** `top` da nav = altura do header; corrigir `rootMargin` do scroll-spy (`sticky-category-nav.tsx:46`, hoje `-96px`) para `header+nav` reais, sincronizando categoria destacada com o que está sob a nav.
3. **Cart bar vs bottom-nav:** esconder a bottom-nav na rota PDV/cardápio (adicionar segmento pdv a `HIDDEN_SEGMENTS` em `bottom-nav.tsx:45`), evitando o conflito z-30 vs z-40 e o CTA obscurecido.
4. **Bottom-nav polish:** labels visíveis em todos os itens (remover `opacity:0` em `globals.css:254`, subir fonte ~10-11px); trocar `router.push` por `<Link prefetch>` (bottom-nav 90-108); estado `active:` pressionado; garantir alvo ≥44px (`.menu__item`).
5. **Drawer:** corrigir origem da animação (painel `left-0` deve usar keyframe `translateX(-100%)`, não `slide-in-right`); remover `pt-safe` duplicado (71+73); adicionar swipe-to-close (Framer Motion); scroll-lock iOS robusto.
6. **Busca:** input `text-base`; `pt-safe` único (88 vs 90); alvo do botão limpar ≥44px (`size-9`+ padding).

**Verificação:** rolar cardápio → header e category-nav permanecem; categoria destacada bate com a seção sob a nav; CTA do carrinho sempre clicável; drawer abre da esquerda e fecha por swipe/backdrop/esc.

---

## Fase 3 — Bottom-sheets nativos

**Arquivos:** `product-details.tsx`, `identify-modal.tsx`, novo componente de confirmação, `account-view.tsx`, `orders-history-view.tsx`.

1. **Grab handle + drag-to-dismiss:** adicionar barra `h-1.5 w-10 rounded-full` no topo; gesto `drag="y"` (Framer Motion) com threshold para fechar, em `product-details` e `identify-modal`.
2. **overscroll-contain:** `overscroll-y-contain` no painel scrollável (`product-details.tsx:90`) para não encadear no body.
3. **Scroll-lock iOS robusto:** substituir `document.body.style.overflow="hidden"` pelo padrão `position:fixed` + salvar/restaurar `scrollY` (`product-details:47`, `identify-modal:58`).
4. **Confirmação in-app:** substituir `window.confirm()` (`account-view:107`, `orders-history:39/59`) por bottom-sheet de confirmação reutilizável.
5. **reduced-motion nos sheets:** `motion-reduce:animate-none` nas entradas.

**Verificação:** sheets abrem/fecham por drag; fundo não rola atrás; posição de scroll preservada ao fechar; confirmações são in-app; com "reduzir movimento" ligado não há animação.

---

## Fase 4 — Formulários & fluxo de pedido

**Arquivos:** `checkout-view.tsx`, `login.tsx`, `identify-modal.tsx`, `account-view.tsx`, `product-card.tsx`, `order-tracker.tsx`, `marketplace-view.tsx`, `restaurant-grid.tsx`, `pizza-loader.tsx`, `mafood-states.tsx`.

1. **Autofill/keyboards:** propagar `type` e `autocomplete` no `Input` do checkout e nos forms; email → `type=email autocomplete=email`; telefone → `type=tel inputMode=tel autocomplete=tel`; cartão → `autocomplete=cc-number|cc-exp|cc-csc`; nome → `autocomplete=name`.
2. **Touch targets 44px:** steppers de quantidade `size-8/size-9` → `size-11` com `min-h-touch min-w-touch` (checkout 528/536, product-card 122/137). Espelhar o padrão correto do `ProductDetails`.
3. **Order tracker:** confiar no realtime já ativo (rebaixar "Atualizar" a fallback discreto), reconciliar cópia contraditória, status/PDV `sticky top-0` com fundo safe-area-aware.
4. **Delay de submit:** reduzir `minDelay` de 5000ms → ~800-1200ms (`checkout-view.tsx:155`).
5. **reduced-motion:** gate GSAP (`gsap.matchMedia`) no pizza-loader/marketplace; `motion-reduce:animate-none` em `animate-pulse-primary` e skeletons.
6. **Overflow/grid:** `min-w-0`+`truncate` em nome de PDV no histórico (`orders-history:138-139`); avaliar `grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3` no `restaurant-grid` (verificar aperto a 320px).
7. **Imagens:** migrar `<img>` de product-card/product-details para `next/image` com `sizes` explícito; remover `loading="lazy"` do hero do sheet (LCP visível).
8. **account-view inputs** `text-sm` → `text-base` (reforço do anti-zoom por elemento).

**Verificação:** focar cada campo → teclado correto + autofill; nenhum tap-target <44px; tracker atualiza sozinho; com reduced-motion nada anima; sem overflow horizontal com strings longas.

---

## Estratégia de teste (todas as fases)

- **Viewports:** 320px (iPhone SE), 375px, 393px (14 Pro, notch), 412px (Pixel), + `env(safe-area-inset-*)` simulado.
- **Checklist por tela:** (a) sem scroll horizontal; (b) todo input não dá zoom no foco; (c) elementos fixos respeitam safe-area e não colidem; (d) alvos ≥44px; (e) reduced-motion respeitado; (f) contraste AA mantido.
- **Build/typecheck:** `pnpm build` / `tsc --noEmit` limpos ao fim de cada fase.
- **Verificação visual real:** rodar a app e exercitar o fluxo cardápio → produto → checkout → tracker em viewport mobile.

## Riscos

- **theme-color global** afeta admin/pay — mitigar com config no route group `(client)` para não regredir outras áreas.
- **Header sticky** pode exigir reajuste do offset do scroll-spy e do padding-top do conteúdo do cardápio; testar junto.
- **Drag-to-dismiss** com Framer Motion não pode quebrar o focus-trap/scroll-lock existentes.
