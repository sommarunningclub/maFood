# maFood Client — Mobile / Native-App Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar toda a experiência mobile do cliente maFood com sensação de app nativo — header fixo, sem zoom acidental, safe-areas corretas, touch UX perfeita, inspirado no iFood.

**Architecture:** Correções em 4 fases sobre o código existente (`src/app/(client)/*`, `src/components/customer/*`, `globals.css`, `layout.tsx`). Resolver na raiz (CSS global) o que se repete entre telas (anti-zoom, tap-highlight, safe-area) e pontualmente o resto. Framer Motion (já dependência) para gestos de bottom-sheet.

**Tech Stack:** Next.js App Router, React 18/19, Tailwind CSS, Framer Motion, GSAP, lucide-react.

## Global Constraints

- **Zoom preservado:** NÃO travar `userScalable`/`maximumScale`. "Sem zoom" = eliminar causas de zoom acidental (inputs `<16px`). WCAG 1.4.4 mantido.
- **Contraste AA mantido:** usar apenas tokens já AA-safe (`--mafood-primary-strong` #A8420F, `--mafood-success-strong` #8A5410, `--mafood-section-title`). Nunca usar `--mafood-primary` (#F26522) como texto/botão pequeno.
- **Reduced-motion respeitado:** toda animação nova precisa de gate (`motion-reduce:` ou `matchMedia`). Já existe um bloco global em `globals.css:326-333`, mas animações JS (GSAP/Framer) precisam de gate próprio.
- **Touch target mínimo:** 44×44px em qualquer elemento acionável.
- **Escopo:** somente cliente. NÃO tocar admin/pdv/pay/landing. `theme-color` global só pode mudar se não regredir admin.
- **Verificação:** `pnpm build` (ou `pnpm tsc --noEmit`) limpo + inspeção visual mobile ao fim de cada task. Não há testes unitários de UI — a verificação é build + visual.
- **Commits frequentes:** um commit por task, mensagem `fix(client): ...` ou `feat(client): ...`, terminando com a linha `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## FASE 1 — Fundamentos globais

### Task 1: Anti-zoom na raiz (remover opt-out `<16px`)

**Files:**
- Modify: `src/app/globals.css:49-55`

**Interfaces:**
- Produces: garantia de que nenhum `<input>` renderiza abaixo de 16px, matando o auto-zoom do iOS na origem.

- [ ] **Step 1: Remover o override que reintroduz font-size <16px**

Em `src/app/globals.css`, apagar o bloco inteiro (linhas 49-55):

```css
/* Permite text-xs explícito quando necessário (filtros, etc) */
input.text-xs,
input.text-\[11px\],
input.text-\[12px\],
input.text-\[13px\] {
  font-size: inherit;
}
```

A regra base (`:44-48`) `input, select, textarea { font-size: max(16px, 1rem); }` permanece e passa a valer sem exceções.

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: build sem erros.

- [ ] **Step 3: Verificação visual**

Abrir DevTools mobile (iPhone SE 320px). Focar um input de busca/filtro. Expected: viewport NÃO dá zoom; texto do input ≥16px.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(client): remove input <16px opt-out that re-enabled iOS zoom

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: overflow-x no body (não no html) + touch-action em conteúdo

**Files:**
- Modify: `src/app/globals.css:10-16`, `src/app/globals.css:57-62`

**Interfaces:**
- Produces: `position: sticky` de headers volta a funcionar de forma confiável; double-tap-zoom suprimido em superfícies interativas.

- [ ] **Step 1: Mover overflow-x para body**

Em `src/app/globals.css`, trocar o bloco `:10-16`:

```css
html,
body {
  margin: 0;
  padding: 0;
  /* Prevenir scroll horizontal acidental em mobile */
  overflow-x: hidden;
}
```

por:

```css
html,
body {
  margin: 0;
  padding: 0;
}
body {
  /* Constrange overflow horizontal sem quebrar position:sticky no html */
  overflow-x: clip;
}
```

- [ ] **Step 2: Estender touch-action ao shell do cliente**

Em `src/app/globals.css`, logo após o bloco `:57-62` (`button, [role="button"], a { touch-action: manipulation; }`), adicionar:

```css
/* App-feel: evita double-tap-zoom nas superfícies de conteúdo do cliente */
.mafood-shell {
  touch-action: manipulation;
}
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build`
Expected: sem erros.

- [ ] **Step 4: Verificação visual**

Em viewport mobile, rolar o marketplace e o cardápio. Expected: sem scroll horizontal; header sticky do marketplace continua grudado; double-tap num card não dá zoom.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "fix(client): move overflow-x to body, add touch-action to shell

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Status bar / theme-color creme no cliente

**Files:**
- Create: `src/app/(client)/layout.tsx` metadata/viewport export (adicionar ao arquivo existente)
- Modify: `src/app/(client)/layout.tsx:1-18`

**Interfaces:**
- Consumes: `Viewport`/`Metadata` do `next`.
- Produces: barra de status com glifos escuros sobre creme nas rotas do cliente, sem alterar admin (que herda o root `#080808`).

- [ ] **Step 1: Adicionar viewport/metadata no route group do cliente**

Em `src/app/(client)/layout.tsx`, no topo adicionar o import e os exports (Next.js faz merge do viewport/metadata mais próximo da rota):

```tsx
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { CustomerBottomNav } from "@/components/customer/bottom-nav";
import { merriweather, dmSans } from "@/lib/fonts";

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "maFood",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf3ea",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};
```

(O `statusBarStyle: "default"` dá glifos escuros — legíveis sobre o creme. `#faf3ea` = `--mafood-background-soft`.)

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: sem erros; sem aviso de viewport/metadata duplicado.

- [ ] **Step 3: Verificação visual**

Em iPhone 14 Pro (393px, notch), abrir uma rota do cliente. Expected: faixa do topo/PWA em tom creme, ícones de status legíveis. Abrir uma rota admin: continua escura (inalterada).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(client)/layout.tsx"
git commit -m "fix(client): cream theme-color and light status bar on client routes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Bottom-nav respeita safe-area no padding de conteúdo

**Files:**
- Modify: `src/app/(client)/layout.tsx:9`

**Interfaces:**
- Consumes: nav fixa com `pb-safe` (linha 12 do mesmo arquivo).
- Produces: conteúdo reserva `72px + safe-area-inset-bottom`, sem esconder o último item atrás da nav no notch.

- [ ] **Step 1: Trocar o padding fixo por calc com safe-area**

Em `src/app/(client)/layout.tsx:9`, trocar:

```tsx
<div className="mx-auto w-full max-w-screen-mobile lg:max-w-3xl flex-1 pb-[72px]">
```

por:

```tsx
<div className="mx-auto w-full max-w-screen-mobile lg:max-w-3xl flex-1 pb-[calc(72px+env(safe-area-inset-bottom))]">
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: sem erros; classe arbitrária aceita pelo Tailwind.

- [ ] **Step 3: Verificação visual**

Em iPhone 14 Pro (393px, notch simulado), abrir marketplace, rolar até o fim. Expected: último conteúdo visível acima da nav; nada atrás da home indicator.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(client)/layout.tsx"
git commit -m "fix(client): reserve bottom-nav height + safe-area in content padding

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Escopar fontes admin fora do cliente

**Files:**
- Modify: `src/app/layout.tsx:1-23`, `src/app/layout.tsx:63-73`

**Interfaces:**
- Consumes: `merriweather`, `dmSans` de `src/lib/fonts.ts` (já usados no `(client)/layout.tsx`).
- Produces: root body sem as 5 famílias admin; cliente carrega só serif+dmsans (já vem do seu próprio layout).

> **Nota:** as classes CSS `.theme-client`/`.theme-admin` em `globals.css` referenciam `--font-jakarta`, `--font-barlow`, `--font-plex-mono`, `--font-inter`, `--font-geist-mono`. Essas variáveis são usadas por admin/pdv. Mover os imports para o layout admin exige que o `<body>` do admin defina essas variáveis. Verifique onde `.theme-admin` é aplicado antes de remover globalmente.

- [ ] **Step 1: Confirmar consumidores das variáveis de fonte**

Run: `grep -rn "font-jakarta\|font-barlow\|font-plex-mono\|font-inter\|font-geist-mono\|theme-admin\|theme-client" src/app src/components --include=*.tsx | grep -v node_modules`
Expected: identificar se algum layout de admin/pdv já define essas variáveis. Se o único ponto for o root `layout.tsx`, elas precisam ficar em um layout que envolva admin/pdv.

- [ ] **Step 2: Manter root font vars, mas remover do body só as não-usadas pelo cliente**

Decisão conservadora (evita regressão admin): manter os imports no root `layout.tsx`, porém garantir que o `(client)` já sobrepõe via `mafood-shell` (font-family própria — já ocorre em `globals.css:301`). Se o grep do Step 1 mostrar que admin tem layout próprio, então mover os 5 imports para `src/app/admin/layout.tsx` e `src/app/pdv/layout.tsx` e removê-los do root.

Se admin NÃO tiver layout próprio que possa hospedar as vars, **pular a remoção** e apenas anotar como dívida — o `mafood-shell` já isola visualmente o cliente. Documentar a decisão no commit.

- [ ] **Step 3: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Abrir cliente (fontes serif/dmsans corretas) e admin (Inter/mono corretos).

- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "perf(client): scope admin fonts away from client tree (or document debt)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## FASE 2 — Header fixo + navegação

### Task 6: Header do restaurante fixo (sticky)

**Files:**
- Modify: `src/components/customer/restaurant-header.tsx:14`

**Interfaces:**
- Produces: header do cardápio permanece no topo ao rolar; `z-40` acima da category-nav (`z-20`).

- [ ] **Step 1: Ler o header e a menu-view para achar a altura**

Run: `sed -n '1,60p' src/components/customer/restaurant-header.tsx` e `sed -n '30,110p' src/components/customer/menu-view.tsx`
Expected: confirmar a tag `<header>` (linha ~14) e como a category-nav se posiciona.

- [ ] **Step 2: Tornar o header sticky**

Em `src/components/customer/restaurant-header.tsx:14`, adicionar `sticky top-0 z-40` às classes do `<header>`:

```tsx
<header className="mafood-header-gradient pt-safe text-white sticky top-0 z-40">
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build`
Expected: sem erros.

- [ ] **Step 4: Verificação visual**

Abrir um cardápio de PDV, rolar. Expected: header (voltar + nome + status) permanece grudado no topo; category-nav dockeia logo abaixo (ajuste fino do offset é a Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/restaurant-header.tsx
git commit -m "feat(client): sticky restaurant header on menu page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Sticky category-nav dockeia sob o header + scroll-spy alinhado

**Files:**
- Modify: `src/components/customer/sticky-category-nav.tsx:46`, `src/components/customer/sticky-category-nav.tsx:74`

**Interfaces:**
- Consumes: header sticky da Task 6.
- Produces: nav pina abaixo do header (não em `top:0` sobrepondo); categoria destacada corresponde à seção sob a nav.

- [ ] **Step 1: Ler o componente inteiro**

Run: `cat src/components/customer/sticky-category-nav.tsx`
Expected: confirmar linha do `rootMargin` (~46) e do `sticky top-0` (~74) e o valor real da altura do header sticky (medir no DevTools: header + nav).

- [ ] **Step 2: Ajustar o top da nav para a altura do header**

Em `sticky-category-nav.tsx:74`, trocar `sticky top-0` para dockear sob o header. Como a altura do header varia com o notch, usar a variável de safe-area no cálculo. Se o header sticky tem altura fixa H (medir), usar `sticky top-[calc(Hpx+env(safe-area-inset-top))]`. Substituir `H` pelo valor medido no Step 1 (ex.: se header = 64px → `top-[calc(64px+env(safe-area-inset-top))]`).

- [ ] **Step 3: Alinhar o rootMargin do scroll-spy**

Em `sticky-category-nav.tsx:46`, o `rootMargin: "-96px 0px -68% 0px"` deve ter o top igual a `header + nav` (altura combinada medida). Ex.: se header 64px + nav 48px = 112px → `rootMargin: "-112px 0px -60% 0px"`. Substituir pelos valores reais medidos.

- [ ] **Step 4: Verificar build**

Run: `pnpm build`
Expected: sem erros.

- [ ] **Step 5: Verificação visual**

Rolar o cardápio devagar. Expected: ao chegar numa seção, a categoria correspondente destaca na nav exatamente quando a seção passa sob a nav (sem defasagem); nav não sobrepõe o header.

- [ ] **Step 6: Commit**

```bash
git add src/components/customer/sticky-category-nav.tsx
git commit -m "fix(client): dock category nav under header, align scroll-spy offset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Esconder bottom-nav na rota do cardápio (resolve cart-bar vs nav)

**Files:**
- Modify: `src/components/customer/bottom-nav.tsx:44-58`

**Interfaces:**
- Consumes: `segments` do pathname.
- Produces: bottom-nav some no cardápio de PDV, eliminando o conflito z-30 (cart bar) vs z-40 (nav) e liberando o CTA de checkout.

- [ ] **Step 1: Detectar a rota de PDV**

A rota do cardápio é `/[venue]/[pdv]` — `segments.length === 2` e `segments[1]` não é rota reservada (`checkout`/`history`/`login`/`order`/`account`). Em `bottom-nav.tsx`, ajustar a condição de ocultação (`:54-58`).

Trocar:

```tsx
  // Hide on checkout, login, order tracker, and root page
  const second = segments[1] ?? "";
  if (!venue || HIDDEN_SEGMENTS.includes(second) || segments.length === 0) {
    return null;
  }
```

por:

```tsx
  // Hide on checkout, login, order tracker, root page, and PDV menu (floating cart bar owns the bottom there)
  const second = segments[1] ?? "";
  const isPdvMenu =
    segments.length === 2 &&
    !["checkout", "history", "login", "order", "account"].includes(second);
  if (!venue || HIDDEN_SEGMENTS.includes(second) || isPdvMenu || segments.length === 0) {
    return null;
  }
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: sem erros.

- [ ] **Step 3: Verificação visual**

Abrir `/[venue]/[pdv]` (cardápio). Expected: bottom-nav ausente; a cart bar flutuante fica sozinha no rodapé e clicável. Voltar para a praça (`/[venue]`): nav volta.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/bottom-nav.tsx
git commit -m "fix(client): hide bottom-nav on PDV menu so cart bar owns the bottom

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Bottom-nav polish — labels visíveis, Link prefetch, pressed state

**Files:**
- Modify: `src/app/globals.css:249-259`, `src/components/customer/bottom-nav.tsx:90-123`

**Interfaces:**
- Produces: todos os itens mostram label; navegação via `<Link prefetch>`; feedback de toque.

- [ ] **Step 1: Tornar labels sempre visíveis e maiores**

Em `src/app/globals.css`, no `.menu__text` (`:249-259`), trocar `opacity: 0` por uma opacidade legível para inativos e subir a fonte:

```css
.menu__text {
  font-family: var(--font-plex-mono), monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.6;
  transform: translateY(0);
  transition: opacity 0.22s ease;
  white-space: nowrap;
  line-height: 1;
}
```

E ajustar `.menu__text.active` (`:261-264`) para:

```css
.menu__text.active {
  opacity: 1;
}
```

- [ ] **Step 2: Trocar router.push por Link com prefetch e adicionar pressed state**

Em `bottom-nav.tsx`, importar `Link` (`import Link from "next/link";`) e substituir o `<button>` (`:105-123`) por um `<Link>`:

```tsx
        return (
          <Link
            key={item.label}
            href={href}
            prefetch
            className={`menu__item active:scale-95 transition-transform ${isActive ? "active" : ""}`}
            ref={(el) => { itemRefs.current[i] = el as unknown as HTMLButtonElement; }}
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
          </Link>
        );
```

Remover a função `handleClick` e o `router` não usados (`:49`, `:90-92`, e o parâmetro `router` de `NavInner`). Ajustar `itemRefs` para `(HTMLAnchorElement | null)[]`.

- [ ] **Step 3: Verificar build**

Run: `pnpm build`
Expected: sem erros de tipo (ajustar tipos dos refs se o TS reclamar).

- [ ] **Step 4: Verificação visual**

Expected: 4 labels visíveis; tab ativa destacada; toque mostra leve scale; troca de aba instantânea (prefetch).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/customer/bottom-nav.tsx
git commit -m "feat(client): visible nav labels, Link prefetch, pressed state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Drawer — origem da animação, pt-safe único, swipe-to-close

**Files:**
- Modify: `src/components/customer/mafood-menu-drawer.tsx:71-73`
- Modify: `tailwind.config.ts` (adicionar keyframe left-origin se necessário)

**Interfaces:**
- Consumes: Framer Motion (já dependência).
- Produces: drawer entra da esquerda, sem pt-safe duplicado, fecha por swipe.

- [ ] **Step 1: Ler o drawer e o keyframe atual**

Run: `cat src/components/customer/mafood-menu-drawer.tsx` e `grep -n "slide-in" tailwind.config.ts`
Expected: confirmar painel `left-0` com `animate-slide-in-right` (keyframe `translateX(100%)`) e o duplo `pt-safe` (linhas 71 e 73).

- [ ] **Step 2: Corrigir origem da animação**

Adicionar em `tailwind.config.ts` (junto aos keyframes existentes) um keyframe left-origin:

```ts
"slide-in-left": {
  "0%": { transform: "translateX(-100%)" },
  "100%": { transform: "translateX(0)" },
},
```

e a animation correspondente:

```ts
"slide-in-left": "slide-in-left 0.28s cubic-bezier(0.4,0,0.2,1)",
```

Em `mafood-menu-drawer.tsx:71`, trocar `animate-slide-in-right` por `animate-slide-in-left`.

- [ ] **Step 3: Remover pt-safe duplicado**

Em `mafood-menu-drawer.tsx`, manter `pt-safe` apenas no elemento mais externo do painel (linha 71) e remover do header interno (linha 73).

- [ ] **Step 4: Adicionar swipe-to-close com Framer Motion**

Envolver o painel num `motion.div` com `drag="x"`, `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={0.2}` e `onDragEnd` que fecha se `info.offset.x < -80`. Importar `motion` de `framer-motion`. Preservar o focus-trap e o scroll-lock existentes.

```tsx
import { motion } from "framer-motion";
// ...painel:
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.2}
  onDragEnd={(_, info) => { if (info.offset.x < -80) onClose(); }}
  className="...classes existentes do painel... pt-safe"
>
```

(Substituir `onClose` pelo nome real da prop de fechar — confirmar no Step 1.)

- [ ] **Step 5: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Abrir o drawer: entra da esquerda; header sem gap duplo; arrastar para a esquerda fecha; backdrop/esc ainda fecham.

- [ ] **Step 6: Commit**

```bash
git add src/components/customer/mafood-menu-drawer.tsx tailwind.config.ts
git commit -m "fix(client): drawer slides from left, single pt-safe, swipe-to-close

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Busca — input 16px, pt-safe único, alvo do clear ≥44px

**Files:**
- Modify: `src/components/customer/mafood-search.tsx:88-90`, `:100`, `:110`

**Interfaces:**
- Produces: busca sem zoom iOS, sem gap duplo, botão limpar acessível.

- [ ] **Step 1: Ler o componente**

Run: `sed -n '80,120p' src/components/customer/mafood-search.tsx`
Expected: confirmar `text-[15px]` no input (linha ~100), `pt-safe` duplicado (88 e 90), clear `size-7` (~110).

- [ ] **Step 2: Input para 16px**

Na linha ~100, trocar `text-[15px]` por `text-base`.

- [ ] **Step 3: pt-safe único**

Remover o `pt-safe` do elemento interno (linha ~90), mantendo só no container externo (linha ~88).

- [ ] **Step 4: Aumentar hit area do clear**

No botão limpar (~110), trocar `size-7` por `size-9` e adicionar `flex items-center justify-center` mantendo o ícone pequeno; opcionalmente usar a classe utilitária `hit-target` já existente (`globals.css:155`).

- [ ] **Step 5: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Focar busca no iPhone SE: sem zoom; sem gap duplo; clear fácil de tocar.

- [ ] **Step 6: Commit**

```bash
git add src/components/customer/mafood-search.tsx
git commit -m "fix(client): search input 16px, single pt-safe, larger clear target

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## FASE 3 — Bottom-sheets nativos

### Task 12: Product-details — grab handle, overscroll-contain, scroll-lock iOS robusto

**Files:**
- Modify: `src/components/customer/product-details.tsx:47`, `:88-91`

**Interfaces:**
- Consumes: Framer Motion.
- Produces: sheet com handle, sem chain scroll no body, posição de scroll preservada.

- [ ] **Step 1: Ler o componente**

Run: `sed -n '40,120p' src/components/customer/product-details.tsx`
Expected: confirmar scroll-lock (`:47`), painel `items-end`/`rounded-t`/`max-h-[88dvh]` (`:88-90`).

- [ ] **Step 2: Scroll-lock iOS robusto (position:fixed + restore)**

Substituir o efeito que faz `document.body.style.overflow = "hidden"` (`:47`) pelo padrão que preserva scroll:

```tsx
useEffect(() => {
  const scrollY = window.scrollY;
  const body = document.body;
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";
  return () => {
    body.style.position = "";
    body.style.top = "";
    body.style.width = "";
    window.scrollTo(0, scrollY);
  };
}, []);
```

- [ ] **Step 3: overscroll-contain no painel scrollável**

Na linha do painel com `overflow-y-auto` (~90), adicionar `overscroll-y-contain`.

- [ ] **Step 4: Grab handle**

No topo do painel (logo dentro do container `rounded-t`), adicionar:

```tsx
<div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
```

- [ ] **Step 5: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Abrir produto: handle visível; rolar até o fim não arrasta a página atrás; fechar volta à mesma posição de scroll.

- [ ] **Step 6: Commit**

```bash
git add src/components/customer/product-details.tsx
git commit -m "feat(client): product sheet handle, overscroll-contain, robust iOS scroll-lock

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Product-details — drag-to-dismiss

**Files:**
- Modify: `src/components/customer/product-details.tsx` (painel)

**Interfaces:**
- Consumes: handle e scroll-lock da Task 12; Framer Motion.
- Produces: arrastar o sheet para baixo fecha.

- [ ] **Step 1: Envolver o painel em motion.div com drag vertical**

Importar `motion` de `framer-motion`. Converter o painel para `motion.div` com:

```tsx
<motion.div
  drag="y"
  dragConstraints={{ top: 0, bottom: 0 }}
  dragElastic={{ top: 0, bottom: 0.4 }}
  onDragEnd={(_, info) => { if (info.offset.y > 120) onClose(); }}
  className="...classes existentes do painel..."
>
```

(Confirmar o nome real da prop de fechar no componente — provavelmente `onClose`/`onDismiss`.)

- [ ] **Step 2: Garantir que o drag não conflite com o scroll interno**

O `drag="y"` deve estar no container do painel, e o conteúdo scrollável (`overflow-y-auto`) permanece filho — o Framer só inicia drag quando o scroll está no topo. Verificar visualmente.

- [ ] **Step 3: Reduced-motion**

Se `matchMedia('(prefers-reduced-motion: reduce)')` for verdadeiro, desabilitar o `drag` (passar `drag={reduced ? false : "y"}`).

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Arrastar o sheet para baixo fecha; rolar o conteúdo interno funciona normal; com reduced-motion ligado, sem drag.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/product-details.tsx
git commit -m "feat(client): drag-to-dismiss on product sheet (reduced-motion aware)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: identify-modal — handle, scroll-lock iOS, reduced-motion

**Files:**
- Modify: `src/components/customer/identify-modal.tsx:58`, `:157-160`

**Interfaces:**
- Produces: modal de identificação com scroll-lock robusto, handle, entrada respeitando reduced-motion.

- [ ] **Step 1: Ler o componente**

Run: `sed -n '50,170p' src/components/customer/identify-modal.tsx`
Expected: confirmar scroll-lock (`:58`), painel bottom-sheet (`:157-160`).

- [ ] **Step 2: Scroll-lock robusto**

Aplicar o mesmo padrão position:fixed+restore da Task 12 Step 2 no efeito de `:58`.

- [ ] **Step 3: Grab handle + reduced-motion na entrada**

Adicionar o handle (`h-1.5 w-10 rounded-full bg-black/15`) no topo do painel. Na classe de animação (`:160`, `slide-in-from-bottom`), adicionar `motion-reduce:animate-none`.

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Abrir modal: handle visível; fundo não rola; com reduced-motion, sem slide.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/identify-modal.tsx
git commit -m "fix(client): identify-modal handle, robust scroll-lock, reduced-motion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Bottom-sheet de confirmação reutilizável (substitui window.confirm)

**Files:**
- Create: `src/components/customer/ui/confirm-sheet.tsx`
- Modify: `src/components/customer/account-view.tsx:107`, `src/components/customer/orders-history-view.tsx:39`, `:59`

**Interfaces:**
- Produces: `useConfirmSheet()` hook ou `<ConfirmSheet>` controlado; substitui `window.confirm()`.

- [ ] **Step 1: Criar o componente ConfirmSheet**

Criar `src/components/customer/ui/confirm-sheet.tsx` como bottom-sheet controlado (props: `open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `destructive`, `onConfirm`, `onCancel`). Reutilizar o padrão visual do identify-modal (backdrop, `items-end`, `rounded-t-2xl`, `pb-safe`, handle, `motion-reduce:animate-none`). Botões com alvo ≥44px; confirm destrutivo usa `--mafood-primary-strong`/vermelho AA.

```tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";

export function ConfirmSheet({
  open, title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar",
  destructive = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; description?: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="relative w-full max-w-screen-mobile rounded-t-2xl bg-[var(--mafood-surface)] p-5 pb-safe"
            role="dialog" aria-modal="true"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--mafood-text-primary)]">{title}</h2>
            {description && <p className="mt-1 text-sm text-[var(--mafood-text-secondary)]">{description}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={onCancel} className="min-h-touch flex-1 rounded-xl border border-[var(--mafood-border)] py-3 font-medium">
                {cancelLabel}
              </button>
              <button onClick={onConfirm}
                className={`min-h-touch flex-1 rounded-xl py-3 font-semibold text-white ${destructive ? "bg-[#B42318]" : "bg-[var(--mafood-primary-strong)]"}`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

(Confirmar que `min-h-touch` existe em `tailwind.config.ts`; se não, usar `min-h-[44px]`.)

- [ ] **Step 2: Substituir window.confirm no account-view**

Em `account-view.tsx:107`, trocar o `window.confirm(...)` do logout por estado `const [confirmLogout, setConfirmLogout] = useState(false)` e renderizar `<ConfirmSheet open={confirmLogout} ... />`. O botão de logout abre o sheet; `onConfirm` executa o logout real.

- [ ] **Step 3: Substituir window.confirm no orders-history**

Em `orders-history-view.tsx:39` (cancelar) e `:59` (remover), aplicar o mesmo padrão com um `<ConfirmSheet>` (pode ser um único sheet com estado guardando a ação pendente).

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Logout e cancelar/remover pedido mostram bottom-sheet in-app (não o diálogo do browser); reduced-motion respeitado.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/ui/confirm-sheet.tsx src/components/customer/account-view.tsx src/components/customer/orders-history-view.tsx
git commit -m "feat(client): in-app confirm bottom-sheet replaces window.confirm

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## FASE 4 — Formulários & fluxo de pedido

### Task 16: Checkout — autofill, type, inputMode corretos

**Files:**
- Modify: `src/components/customer/checkout-view.tsx:350`, `:395`, `:685-713` (componente `Input`), campos de cartão

**Interfaces:**
- Produces: `Input` aceita `type` e `autoComplete`; teclados e autofill corretos.

- [ ] **Step 1: Ler o componente Input e os campos**

Run: `sed -n '340,400p' src/components/customer/checkout-view.tsx` e `sed -n '680,720p' src/components/customer/checkout-view.tsx`
Expected: confirmar a assinatura do `Input` (linha ~685) e cada campo (email 350, telefone 395, cartão).

- [ ] **Step 2: Propagar type e autoComplete no Input**

No componente `Input` (~685-713), adicionar `type` e `autoComplete` às props e repassar ao `<input>` nativo (mantendo o restante). Garantir `className` do input com `text-base` (reforço anti-zoom).

- [ ] **Step 3: Setar atributos por campo**

- Email (~350): `type="email" inputMode="email" autoComplete="email"`
- Telefone (~395): `type="tel" inputMode="tel" autoComplete="tel"`
- Nome (se houver): `autoComplete="name"`
- CEP: `inputMode="numeric" autoComplete="postal-code"`
- Cartão número: `inputMode="numeric" autoComplete="cc-number"`
- Validade: `autoComplete="cc-exp"` (ou `cc-exp-month`/`cc-exp-year` se separados)
- CVV: `inputMode="numeric" autoComplete="cc-csc"`

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Focar cada campo no mobile: teclado correto (email/tel/numérico); sugestões de autofill aparecem; sem zoom.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/checkout-view.tsx
git commit -m "feat(client): correct type/inputMode/autocomplete on checkout fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Touch targets 44px nos steppers de quantidade

**Files:**
- Modify: `src/components/customer/checkout-view.tsx:528`, `:536`; `src/components/customer/product-card.tsx:122`, `:137`

**Interfaces:**
- Produces: botões +/- ≥44px.

- [ ] **Step 1: Checkout steppers**

Em `checkout-view.tsx:528` e `:536`, trocar `size-8` por `size-11` (44px). Se o layout apertar, envolver com `min-h-touch min-w-touch` e manter o ícone no tamanho atual.

- [ ] **Step 2: Product-card steppers**

Em `product-card.tsx:122` e `:137`, trocar `size-9` por `size-11`.

- [ ] **Step 3: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Steppers no iPhone SE fáceis de tocar, sem mis-tap entre + e -.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/checkout-view.tsx src/components/customer/product-card.tsx
git commit -m "fix(client): 44px touch targets on quantity steppers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: account-view — inputs 16px, inputMode/autocomplete, pb-safe

**Files:**
- Modify: `src/components/customer/account-view.tsx:115`, `:180-205`

**Interfaces:**
- Produces: form da conta sem zoom, com autofill, sem colidir com home indicator.

- [ ] **Step 1: Inputs 16px + atributos**

Em `account-view.tsx` nome (~180), email (~188/195), telefone (~201/205): trocar `text-sm` por `text-base`; adicionar `autoComplete="name|email|tel"` e telefone `inputMode="tel"`.

- [ ] **Step 2: pb-safe no root**

No `<div>` root da view (~115), adicionar `pb-safe` (ou `pb-[calc(env(safe-area-inset-bottom)+1rem)]`) para o botão logout não encostar na home indicator.

- [ ] **Step 3: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Focar campos: sem zoom, teclado tel correto; logout acima da home indicator.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/account-view.tsx
git commit -m "fix(client): account form 16px inputs, autofill, pb-safe

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: login & identify-modal — inputMode/autocomplete

**Files:**
- Modify: `src/components/customer/login.tsx:286`, `:296`, `:305-308`; `src/components/customer/identify-modal.tsx:320`, `:330`, `:339-341`

**Interfaces:**
- Produces: forms de login/identificação com autofill e teclado tel.

- [ ] **Step 1: Login**

Em `login.tsx`: nome (~286) `autoComplete="name"`; email (~296) `type="email" autoComplete="email"`; telefone (~305-308) `type="tel" inputMode="tel" autoComplete="tel"`. CPF: sem token padrão, deixar `inputMode="numeric"` como está.

- [ ] **Step 2: identify-modal**

Aplicar os mesmos atributos em `identify-modal.tsx` nome (~320), email (~330), telefone (~339-341).

- [ ] **Step 3: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Teclado tel no telefone; autofill de contato aparece.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/login.tsx src/components/customer/identify-modal.tsx
git commit -m "fix(client): tel keyboard + autocomplete on login/identify forms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Order-tracker — realtime, status sticky, cópia reconciliada

**Files:**
- Modify: `src/components/customer/order-tracker.tsx:233`, `:263`, `:266-273`

**Interfaces:**
- Consumes: subscription realtime já ativa (`:110-123`).
- Produces: status sticky, botão "Atualizar" rebaixado a fallback discreto, cópia consistente.

- [ ] **Step 1: Ler o trecho**

Run: `sed -n '225,280p' src/components/customer/order-tracker.tsx` e `sed -n '450,465p' src/components/customer/order-tracker.tsx`
Expected: confirmar headline (~233), cópia contraditória (~263), botão refresh (~266-273), footer "tempo real" (~461).

- [ ] **Step 2: Tornar o status headline sticky**

No wrapper do status/PDV (~233), adicionar `sticky top-0 z-20` com fundo `bg-[var(--mafood-background)]` e `pt-safe` para não colidir com o notch.

- [ ] **Step 3: Rebaixar o botão Atualizar e reconciliar a cópia**

Trocar a cópia de `:263` ("Atualize aqui para saber a hora de retirar") por algo alinhado ao realtime (ex.: "Acompanhe em tempo real — atualizamos automaticamente"). Transformar o botão (~266-273) num link/texto discreto de fallback ("Não atualizou? Toque para recarregar") em vez de CTA primário.

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Status fica fixo ao rolar; cópia consistente com o realtime; refresh é secundário.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/order-tracker.tsx
git commit -m "fix(client): sticky order status, realtime-first copy, refresh as fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Reduced-motion nas animações JS (GSAP/pulse)

**Files:**
- Modify: `src/components/customer/pizza-loader.tsx:52-65`, `src/components/customer/marketplace-view.tsx:68-103`, `src/components/customer/orders-history-view.tsx:125`, `src/components/customer/ui/mafood-states.tsx:66-80`

**Interfaces:**
- Produces: nenhuma animação infinita/entrada roda com `prefers-reduced-motion: reduce`.

- [ ] **Step 1: Gate GSAP com matchMedia**

Em `pizza-loader.tsx` e `marketplace-view.tsx`, envolver os tweens GSAP em `gsap.matchMedia()`:

```tsx
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => {
  // ...tweens existentes...
});
return () => mm.revert();
```

- [ ] **Step 2: motion-reduce nas classes de pulse**

Em `orders-history-view.tsx:125` (`animate-pulse-primary`) e `mafood-states.tsx:66-80` (`animate-pulse`), adicionar `motion-reduce:animate-none`.

- [ ] **Step 3: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Com "reduzir movimento" ligado (DevTools > Rendering > emulate prefers-reduced-motion): pizza-loader estático, cards sem entrada animada, pulses parados. Sem a preferência: animações normais.

- [ ] **Step 4: Commit**

```bash
git add src/components/customer/pizza-loader.tsx src/components/customer/marketplace-view.tsx src/components/customer/orders-history-view.tsx src/components/customer/ui/mafood-states.tsx
git commit -m "fix(client): honor prefers-reduced-motion in GSAP and pulse animations

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Overflow, grid e delay de submit

**Files:**
- Modify: `src/components/customer/orders-history-view.tsx:138-139`, `src/components/customer/restaurant-grid.tsx:154`, `src/components/customer/checkout-view.tsx:155`

**Interfaces:**
- Produces: sem overflow horizontal com nomes longos; grid confortável a 320px; submit responsivo.

- [ ] **Step 1: Truncar nome do PDV no histórico**

Em `orders-history-view.tsx:138`, adicionar `min-w-0` ao flex child; em `:139`, adicionar `truncate` ao `<p>` do `pdv_name`.

- [ ] **Step 2: Grid responsivo**

Em `restaurant-grid.tsx:154`, avaliar `grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3` no lugar de `grid-cols-2` fixo. Verificar visualmente a 320px; se 2-col couber bem após as outras correções, manter `grid-cols-2` e só garantir truncate dos textos internos.

- [ ] **Step 3: Reduzir delay de submit**

Em `checkout-view.tsx:155`, trocar `minDelay = 5000` por `minDelay = 1000`.

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros. Histórico com nome longo não estoura; grid ok a 320px; submit sente-se rápido (~1s mínimo).

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/orders-history-view.tsx src/components/customer/restaurant-grid.tsx src/components/customer/checkout-view.tsx
git commit -m "fix(client): truncate long names, responsive grid, faster submit feedback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: Imagens com next/image no fluxo de produto

**Files:**
- Modify: `src/components/customer/product-card.tsx:93`, `src/components/customer/product-details.tsx:96-99`

**Interfaces:**
- Produces: thumbnails e hero otimizados, sem lazy no LCP visível.

> **Nota:** confirmar `next.config` `images.remotePatterns`/`domains` para o host das imagens de produto antes de migrar; se o host não estiver liberado, `next/image` quebra. Se não puder liberar, manter `<img>` mas adicionar `loading`/`decoding` corretos e remover `lazy` do hero.

- [ ] **Step 1: Verificar config de imagens**

Run: `grep -n "remotePatterns\|domains\|images" next.config.*`
Expected: saber se o host das imagens está liberado.

- [ ] **Step 2: Migrar product-card thumbnail**

Se liberado: em `product-card.tsx:93`, trocar `<img>` por `next/image` `Image` com `width`/`height` (88) e `sizes="88px"`. Manter o `alt`.

- [ ] **Step 3: Migrar product-details hero**

Em `product-details.tsx:96`, trocar `<img>` por `Image` com `fill` dentro do box `aspect-[16/10]`, `sizes="100vw"`; remover `loading="lazy"` (`:99`) e usar `priority` (é o LCP do sheet).

- [ ] **Step 4: Verificar build + visual**

Run: `pnpm build`
Expected: sem erros de host de imagem. Card e sheet carregam imagens otimizadas; hero aparece sem atraso.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/product-card.tsx src/components/customer/product-details.tsx
git commit -m "perf(client): next/image for product thumbnail and sheet hero

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] **Build limpo:** `pnpm build` e `pnpm tsc --noEmit` sem erros.
- [ ] **Sweep visual por viewport** (320 / 375 / 393-notch / 412) em cada tela do cliente: marketplace, cardápio, produto, checkout, tracker, histórico, conta, login, modais. Checklist por tela: (a) sem scroll horizontal; (b) todo input não dá zoom no foco; (c) fixos respeitam safe-area e não colidem; (d) alvos ≥44px; (e) reduced-motion respeitado; (f) contraste AA mantido.
- [ ] **Header fixo confirmado** em marketplace e cardápio.
- [ ] **Fluxo end-to-end** cardápio → produto → checkout → tracker exercitado no app real (skill `run`/`verify`).
- [ ] **Regressão admin:** abrir uma tela admin e confirmar tema/fonte/status-bar inalterados.

## Notas de sequência

- Fase 1 é pré-requisito das demais (anti-zoom, safe-area, overflow).
- Task 6 (header sticky) precede Task 7 (offset da nav) — medir alturas reais no DevTools durante a Task 6.
- Tasks 12→13 são sequenciais (handle/scroll-lock antes do drag).
- Task 23 depende de config de host de imagem — pode virar dívida se o host não estiver liberado.
