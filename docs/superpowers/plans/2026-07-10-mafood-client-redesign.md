# maFood Client Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the maFood customer-facing screens into a warm, mobile-first light theme (teal + coral, Merriweather + DM Sans) and route payment so only Bebidas PDVs sell/charge in-app while all other PDVs are menu-only.

**Architecture:** New `--mafood-*` design system scoped to a `.mafood-shell` root on the `(client)` layout, leaving admin/PDV dark themes (`somma-*`/`palantir-*`) untouched. A single `pdvSellsOnline()` helper drives the business bifurcation on client + server. Existing data flow, cart store, Asaas checkout, and API contracts are preserved — only presentation and one payment-routing guard change.

**Tech Stack:** Next.js 14.2 (App Router), React 18, Tailwind 3.4, Supabase, React Query, Zustand, Framer Motion + GSAP, lucide-react, `next/font/google`. New dev dep: `vitest` (business-rule unit test only).

## Global Constraints

- **Redesign scope is customer-facing only.** Never edit `src/components/admin/**`, `src/app/admin/**`, `src/components/pdv/**`, `src/app/pdv/**`, or `src/app/loja/**`. Never touch `palantir-*` tokens.
- **Preserve all logic.** Do not change `src/stores/cart-store.ts`, `src/lib/asaas.ts`, webhooks, the `orders`/`order_items`/`coupons` schema, auth, routes, URL params, or API contracts (beyond the one additive `category` select + guard in Task 2).
- **Business rule:** a PDV sells/charges in-app **iff** `category.trim().toLowerCase() === "bebidas"`. Always go through the `pdvSellsOnline()` helper — never inline the string compare.
- **No mock data.** Carousel/promo components render only with real data (none today → stay hidden). Footer shows only real links/socials.
- **Design tokens are scoped to `.mafood-shell`.** No literal hex colors in components — use `mafood.*` Tailwind utilities or `var(--mafood-*)`.
- **Fonts:** Merriweather (700, 700italic) for titles; DM Sans (400/500/600/700) for body/UI. Load only these weights.
- **Mobile-first targets:** must not overflow horizontally at 320/360/375/390/414/430px; desktop uses a max width, not a stretched mobile.
- **Accessibility:** semantic HTML, real `<button>`/`<a>`, labeled fields, `alt` on images, visible focus, ≥44px touch targets, focus management on drawer/sheet, `prefers-reduced-motion` honored.
- **Verification gate:** every task ends green on `npm run lint` and `npm run build`. Visual tasks add manual viewport checks. There is no RTL infra — do not invent component unit tests; use build + manual verification instead.

---

## File Structure

**Foundation**
- `src/app/globals.css` — add `.mafood-shell` token block, signature classes, `prefers-reduced-motion`.
- `tailwind.config.ts` — add `colors.mafood.*`, `fontFamily.serif`/`fontFamily.dmsans`.
- `src/lib/fonts.ts` (new) — `next/font/google` Merriweather + DM Sans exports.
- `src/app/(client)/layout.tsx` — swap `theme-client somma-grain` → `.mafood-shell` + font vars; desktop max width.
- `src/lib/pdv.ts` (new) — `pdvSellsOnline()`.
- `src/lib/pdv.test.ts` (new) — vitest unit test.
- `vitest.config.ts` (new), `package.json` — vitest dep + `test` script.
- `src/app/api/customer/orders/route.ts` — additive `category` select + guard.

**New customer components** (`src/components/customer/`)
- `mafood-header.tsx` — `MaFoodHeader`
- `mafood-menu-drawer.tsx` — `MaFoodMenuDrawer`
- `mafood-search.tsx` — `MaFoodSearch` + `SearchModal`
- `ui/section-heading.tsx` — `SectionHeading`
- `ui/mafood-states.tsx` — `EmptyState`, `ErrorState`, `LoadingSkeleton`
- `category-rail.tsx` — `HorizontalCategoryList` + `CategoryCard`
- `restaurant-grid.tsx` — `RestaurantGrid` + `RestaurantCard` + `RestaurantStatus` + `CategoryBadge`
- `restaurant-header.tsx` — `RestaurantHeader`
- `sticky-category-nav.tsx` — `StickyCategoryNavigation`
- `product-card.tsx` — `ProductCard` (+ `ProductSection` wrapper)
- `product-details.tsx` — `ProductDetails` bottom sheet
- `mafood-footer.tsx` — `MaFoodFooter`

**Redesigned in place** (logic preserved)
- `marketplace-view.tsx`, `menu-view.tsx`, `checkout-view.tsx`, `order-tracker.tsx`, `orders-history-view.tsx`, `account-view.tsx`, `bottom-nav.tsx`, `identify-modal.tsx`, `login.tsx`.

---

## Task 1: Design tokens, fonts, and shell

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`
- Create: `src/lib/fonts.ts`
- Modify: `src/app/(client)/layout.tsx`

**Interfaces:**
- Produces: `.mafood-shell` root class exposing `--mafood-*` vars + `--font-serif`/`--font-dmsans`; Tailwind utilities `bg-mafood-*`, `text-mafood-*`, `border-mafood-border`, `font-serif`, `font-dmsans`, `shadow-mafood-sm/md/lg`, `rounded-mafood-sm/md/lg/xl`; signature class `.mafood-section-title`. All later tasks consume these.

- [ ] **Step 1: Add the font module**

Create `src/lib/fonts.ts`:

```ts
import { Merriweather, DM_Sans } from "next/font/google";

export const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dmsans",
  display: "swap",
});
```

- [ ] **Step 2: Add the token block + signature classes to `globals.css`**

Append to `src/app/globals.css`:

```css
/* ── maFood client design system (scoped) ───────────────────────── */
.mafood-shell {
  --mafood-primary: #0e5b56;
  --mafood-primary-dark: #034b46;
  --mafood-primary-light: #75ccd8;
  --mafood-accent: #d6675e;
  --mafood-accent-dark: #c45a52;
  --mafood-accent-light: #e8796c;
  --mafood-gold: #f4b45e;
  --mafood-success: #10a53d;
  --mafood-success-bright: #22c55e;
  --mafood-section-title: #017a37;
  --mafood-background: #f5f0e8;
  --mafood-background-soft: #f2f6ec;
  --mafood-background-warm: #faf9f5;
  --mafood-surface: #fffdf9;
  --mafood-surface-strong: #ffffff;
  --mafood-text-primary: #17211d;
  --mafood-text-secondary: #666d69;
  --mafood-text-muted: #969d99;
  --mafood-border: rgba(3, 75, 70, 0.12);
  --mafood-shadow-sm: 0 2px 8px rgba(3, 75, 70, 0.08);
  --mafood-shadow-md: 0 4px 16px rgba(3, 75, 70, 0.14), 0 1px 4px rgba(0, 0, 0, 0.08);
  --mafood-shadow-lg: 0 16px 40px rgba(3, 75, 70, 0.18);
  --mafood-radius-sm: 10px;
  --mafood-radius-md: 16px;
  --mafood-radius-lg: 24px;
  --mafood-radius-xl: 32px;
  --mafood-radius-pill: 9999px;
  --mafood-space-page: 16px;

  background: var(--mafood-background);
  color: var(--mafood-text-primary);
  font-family: var(--font-dmsans), system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}

.mafood-shell .mafood-display,
.mafood-shell .mafood-product-title,
.mafood-shell .mafood-restaurant-title {
  font-family: var(--font-serif), Georgia, serif;
}

.mafood-shell .mafood-section-title {
  font-family: var(--font-serif), Georgia, serif;
  font-style: italic;
  font-weight: 700;
  color: var(--mafood-section-title);
}

/* Header green gradient + CSS-only geometric texture */
.mafood-header-gradient {
  background:
    repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 10px),
    linear-gradient(168deg, #007a33 0%, #0a524d 50%, #019b42 100%);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Extend `tailwind.config.ts`**

In `theme.extend.colors`, add a sibling to `somma`:

```ts
mafood: {
  primary: "var(--mafood-primary)",
  "primary-dark": "var(--mafood-primary-dark)",
  "primary-light": "var(--mafood-primary-light)",
  accent: "var(--mafood-accent)",
  "accent-dark": "var(--mafood-accent-dark)",
  "accent-light": "var(--mafood-accent-light)",
  gold: "var(--mafood-gold)",
  success: "var(--mafood-success)",
  "success-bright": "var(--mafood-success-bright)",
  "section-title": "var(--mafood-section-title)",
  background: "var(--mafood-background)",
  "background-soft": "var(--mafood-background-soft)",
  "background-warm": "var(--mafood-background-warm)",
  surface: "var(--mafood-surface)",
  "surface-strong": "var(--mafood-surface-strong)",
  "text-primary": "var(--mafood-text-primary)",
  "text-secondary": "var(--mafood-text-secondary)",
  "text-muted": "var(--mafood-text-muted)",
  border: "var(--mafood-border)",
},
```

In `theme.extend`, add:

```ts
boxShadow: {
  "mafood-sm": "var(--mafood-shadow-sm)",
  "mafood-md": "var(--mafood-shadow-md)",
  "mafood-lg": "var(--mafood-shadow-lg)",
},
borderRadius: {
  admin: "0px",
  client: "6px",
  "mafood-sm": "var(--mafood-radius-sm)",
  "mafood-md": "var(--mafood-radius-md)",
  "mafood-lg": "var(--mafood-radius-lg)",
  "mafood-xl": "var(--mafood-radius-xl)",
},
```

In `theme.extend.fontFamily`, add:

```ts
serif: ["var(--font-serif)", "Georgia", "serif"],
dmsans: ["var(--font-dmsans)", "system-ui", "sans-serif"],
```

(Keep the existing `borderRadius.admin`/`borderRadius.client` — merge, do not replace.)

- [ ] **Step 4: Rewrite the client shell**

Replace `src/app/(client)/layout.tsx` body with:

```tsx
import { Providers } from "@/components/providers";
import { CustomerBottomNav } from "@/components/customer/bottom-nav";
import { merriweather, dmSans } from "@/lib/fonts";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className={`mafood-shell ${merriweather.variable} ${dmSans.variable} min-h-dvh-100 flex flex-col`}>
        <div className="mx-auto w-full max-w-screen-mobile lg:max-w-3xl flex-1 pb-[72px]">
          {children}
        </div>
        <div className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-screen-mobile lg:max-w-3xl bg-mafood-surface-strong/95 backdrop-blur border-t border-mafood-border pb-safe">
          <CustomerBottomNav />
        </div>
      </div>
    </Providers>
  );
}
```

- [ ] **Step 5: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: PASS. Then `npm run dev`, open `/<venue>` on a 390px viewport — background is cream `#f5f0e8`, no console errors, fonts load. (Marketplace still uses old markup — that's fine; only the shell changed here.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/fonts.ts src/app/globals.css tailwind.config.ts "src/app/(client)/layout.tsx"
git commit -m "feat(client): maFood design tokens, fonts and shell"
```

---

## Task 2: Business rule — `pdvSellsOnline` + server guard

**Files:**
- Create: `src/lib/pdv.ts`
- Create: `src/lib/pdv.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `src/app/api/customer/orders/route.ts:90-96`

**Interfaces:**
- Produces: `pdvSellsOnline(pdv: { category?: string | null }): boolean` — used by Tasks 4 (marketplace selo) and 5 (menu bifurcation) and this task's server guard.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pdv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pdvSellsOnline } from "./pdv";

describe("pdvSellsOnline", () => {
  it("is true for Bebidas (case/space insensitive)", () => {
    expect(pdvSellsOnline({ category: "Bebidas" })).toBe(true);
    expect(pdvSellsOnline({ category: " bebidas " })).toBe(true);
    expect(pdvSellsOnline({ category: "BEBIDAS" })).toBe(true);
  });
  it("is false for food and empty categories", () => {
    expect(pdvSellsOnline({ category: "Hamburgueria" })).toBe(false);
    expect(pdvSellsOnline({ category: "" })).toBe(false);
    expect(pdvSellsOnline({ category: null })).toBe(false);
    expect(pdvSellsOnline({})).toBe(false);
  });
});
```

- [ ] **Step 2: Add vitest + run to see it fail**

```bash
npm i -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

Run: `npm test`
Expected: FAIL — `Cannot find module './pdv'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/pdv.ts`:

```ts
/**
 * A PDV sells and charges inside maFood (Asaas flow) only when it is a
 * beverages PDV. Single source of truth for the payment-routing rule —
 * change here if the rule evolves (e.g. an admin toggle).
 */
export function pdvSellsOnline(pdv: { category?: string | null }): boolean {
  return (pdv.category ?? "").trim().toLowerCase() === "bebidas";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (5 assertions).

- [ ] **Step 5: Add the server guard**

In `src/app/api/customer/orders/route.ts`, add the import near the top (after line 13):

```ts
import { pdvSellsOnline } from "@/lib/pdv";
```

Change the PDV select (line ~90-94) to include `category`:

```ts
  const { data: pdv, error: ePdv } = await supabase
    .from("pdvs")
    .select("id, venue_id, name, is_open, category")
    .eq("id", body.pdv_id)
    .maybeSingle();
  if (ePdv || !pdv) return NextResponse.json({ error: "PDV invalido" }, { status: 400 });
  if (!pdv.is_open) return NextResponse.json({ error: "PDV fechado" }, { status: 400 });
  if (!pdvSellsOnline(pdv))
    return NextResponse.json(
      { error: "Este PDV não aceita pagamento pelo app" },
      { status: 422 }
    );
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pdv.ts src/lib/pdv.test.ts vitest.config.ts package.json package-lock.json src/app/api/customer/orders/route.ts
git commit -m "feat(payments): only Bebidas PDVs sell in-app (helper + server guard)"
```

---

## Task 3: Header + menu drawer

**Files:**
- Create: `src/components/customer/mafood-header.tsx`
- Create: `src/components/customer/mafood-menu-drawer.tsx`
- Create: `src/components/customer/ui/section-heading.tsx`

**Interfaces:**
- Consumes: `mafood.*` utilities (Task 1).
- Produces:
  - `MaFoodHeader({ venueSlug, onOpenSearch, onOpenMenu }: { venueSlug: string; onOpenSearch?: () => void; onOpenMenu?: () => void })`
  - `MaFoodMenuDrawer({ open, onClose, venueSlug }: { open: boolean; onClose: () => void; venueSlug: string })`
  - `SectionHeading({ children, className }: { children: React.ReactNode; className?: string })`

- [ ] **Step 1: SectionHeading**

Create `src/components/customer/ui/section-heading.tsx`:

```tsx
export function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mafood-section-title text-xl leading-tight ${className}`}>
      {children}
    </h2>
  );
}
```

- [ ] **Step 2: MaFoodHeader**

Create `src/components/customer/mafood-header.tsx`:

```tsx
"use client";

import { Menu, Search } from "lucide-react";

export function MaFoodHeader({
  venueSlug,
  onOpenSearch,
  onOpenMenu,
}: {
  venueSlug: string;
  onOpenSearch?: () => void;
  onOpenMenu?: () => void;
}) {
  return (
    <header className="mafood-header-gradient sticky top-0 z-30 pt-safe rounded-b-mafood-lg text-white shadow-mafood-md">
      <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="mafood-display text-lg tracking-tight">maFood</span>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Abrir menu"
            className="grid size-11 place-items-center rounded-mafood-md bg-white/10 backdrop-blur-sm border border-white/15 active:scale-95 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Menu className="size-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar"
          className="flex items-center gap-2 w-full h-12 rounded-mafood-md bg-mafood-surface-strong text-mafood-text-muted px-4 shadow-mafood-sm active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <Search className="size-4 text-mafood-primary" />
          <span className="text-sm">Buscar restaurantes, categorias…</span>
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: MaFoodMenuDrawer (focus-trap + Escape + scroll-lock)**

Create `src/components/customer/mafood-menu-drawer.tsx`:

```tsx
"use client";

import Link from "next/link";
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

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = [
    { href: `/${venueSlug}`, label: "Restaurantes", icon: Store },
    { href: `/${venueSlug}/history`, label: "Meus pedidos", icon: ClipboardList },
    { href: `/${venueSlug}/account`, label: "Minha conta", icon: User },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 w-[82%] max-w-xs bg-mafood-surface-strong shadow-mafood-lg flex flex-col pt-safe animate-slide-in-right"
      >
        <div className="mafood-header-gradient px-5 py-5 pt-safe flex items-center justify-between text-white">
          <span className="mafood-display text-lg">maFood</span>
          <button type="button" onClick={onClose} aria-label="Fechar menu" className="grid size-10 place-items-center rounded-mafood-md bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 p-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose}
              className="flex items-center gap-3 px-3 h-12 rounded-mafood-md text-mafood-text-primary hover:bg-mafood-background-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-primary">
              <Icon className="size-5 text-mafood-primary" />
              <span className="text-[15px]">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-mafood-border pb-safe">
          <Link href={`/${venueSlug}/login?logout=1`} onClick={onClose}
            className="flex items-center gap-3 px-3 h-12 rounded-mafood-md text-mafood-accent-dark hover:bg-mafood-background-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-mafood-accent">
            <LogOut className="size-5" />
            <span className="text-[15px]">Sair</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

Note: the "Sair" target reuses whatever logout flow the existing `bottom-nav`/`account-view` uses. Before writing, grep `src/components/customer/account-view.tsx` and `bottom-nav.tsx` for the current logout action (route or handler) and match it exactly — do not invent an endpoint.

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: PASS. (Components not yet mounted; this just confirms they compile.)

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/mafood-header.tsx src/components/customer/mafood-menu-drawer.tsx src/components/customer/ui/section-heading.tsx
git commit -m "feat(client): MaFoodHeader, MenuDrawer and SectionHeading"
```

---

## Task 4: Home / marketplace redesign

**Files:**
- Create: `src/components/customer/restaurant-grid.tsx`
- Create: `src/components/customer/category-rail.tsx`
- Create: `src/components/customer/mafood-search.tsx`
- Create: `src/components/customer/mafood-footer.tsx`
- Create: `src/components/customer/ui/mafood-states.tsx`
- Modify: `src/components/customer/marketplace-view.tsx` (full rewrite of the presentation; keep the `PdvCardData` interface + props signature)

**Interfaces:**
- Consumes: `MaFoodHeader`, `MaFoodMenuDrawer`, `SectionHeading` (Task 3); `pdvSellsOnline` (Task 2).
- `MarketplaceView` keeps its existing props exactly: `{ venueSlug, venueName, venueDescription, pdvs: PdvCardData[] }` and the exported `PdvCardData` shape (see `marketplace-view.tsx:10-22`) — the page in `src/app/(client)/[venue]/page.tsx` passes these unchanged.
- Produces:
  - `RestaurantGrid({ venueSlug, pdvs })`, `RestaurantCard`, `RestaurantStatus({ isOpen })`, `CategoryBadge({ label })`
  - `HorizontalCategoryList({ categories, active, onSelect })`, `CategoryCard`
  - `MaFoodSearch` (already the header button) + `SearchModal({ open, onClose, venueSlug, pdvs })`
  - `MaFoodFooter({ venueSlug })`
  - `EmptyState({ title, hint })`, `ErrorState({ title })`, `LoadingSkeleton({ variant })`

- [ ] **Step 1: State components**

Create `src/components/customer/ui/mafood-states.tsx` with `EmptyState`, `ErrorState`, and `LoadingSkeleton` (variants `"card" | "row"`). Use `bg-mafood-background-soft` blocks with `animate-pulse` for skeletons; centered muted text for empty/error. No spinners.

- [ ] **Step 2: RestaurantCard + grid (with selo + real status)**

Create `src/components/customer/restaurant-grid.tsx`. Card is a light surface, `rounded-mafood-lg`, `shadow-mafood-sm`, circular logo via existing `PdvLogo` (`@/components/pdv-logo`), name in `.mafood-restaurant-title`, `CategoryBadge`, `RestaurantStatus` (green dot when `is_open`, muted "Fechado" otherwise), and a selo derived from `pdvSellsOnline(pdv)`: `"Pedir & pagar aqui"` (accent) vs `"Cardápio"` (neutral). Grid: `grid-cols-2 lg:grid-cols-3 gap-3`. Closed PDVs render at reduced opacity and are non-interactive; open PDVs are `<Link href={`/${venueSlug}/${pdv.slug}`}>` with tap-scale + focus ring. Reuse the price-range label logic from the current `PdvCard` (`marketplace-view.tsx:243-251`).

Acceptance: status/selo come only from real `is_open`/`category`; never hardcode "aberto".

- [ ] **Step 3: Category rail**

Create `src/components/customer/category-rail.tsx`. `HorizontalCategoryList` renders `CategoryCard`s (≈140×88, `rounded-mafood-md`, gradient overlay, name in serif) in a horizontal `overflow-x-auto` with `snap-x` + `no-scrollbar`. Active state highlighted; `onSelect(category | "all")` filters the grid. Categories = distinct `pdv.category` values from props.

- [ ] **Step 4: SearchModal (client-side over PDVs + categories)**

Create `src/components/customer/mafood-search.tsx` exporting `SearchModal`. Full-screen sheet with a real `<input>` (autofocus, clear button, `aria-label`), filtering `pdvs` by name/category (normalized `includes`). Group results and link open PDVs to their menu. Empty query → show category chips; no matches → `EmptyState`. Escape + backdrop close; scroll-lock while open. (`MaFoodSearch` = the header trigger button already built in Task 3.)

- [ ] **Step 5: Footer (real data only)**

Create `src/components/customer/mafood-footer.tsx`. Green gradient card (`mafood-header-gradient`, `rounded-mafood-xl`), maFood wordmark, and only links that already exist in the app (Restaurantes, Meus pedidos, Conta). Do not add social/institutional links unless a real source exists. If none, omit that block.

- [ ] **Step 6: Rewrite `MarketplaceView` presentation**

Rewrite the returned JSX of `marketplace-view.tsx` to compose: `MaFoodHeader` (wired to local `search`/`menu` open state + `MaFoodMenuDrawer` + `SearchModal`) → editorial hero from real `venueName`/`venueDescription` (+ keep the existing date/location badge) → `SectionHeading` "Explorar" + `HorizontalCategoryList` → `SectionHeading` "Restaurantes" + `RestaurantGrid` (filtered by active category) → `MaFoodFooter`. Preserve the GSAP entrance (retarget refs to the new nodes) and the `filter`/`openCount` memo logic. Keep `export interface PdvCardData` unchanged.

- [ ] **Step 7: Verify (build + viewports)**

Run: `npm run lint && npm run build`. Then `npm run dev`: at 320/390/430px confirm no horizontal overflow, header sticky without jump, category rail scrolls with snap, search opens/filters/closes, grid shows real status + correct selo per PDV, footer renders. Console clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/customer/restaurant-grid.tsx src/components/customer/category-rail.tsx src/components/customer/mafood-search.tsx src/components/customer/mafood-footer.tsx src/components/customer/ui/mafood-states.tsx src/components/customer/marketplace-view.tsx
git commit -m "feat(client): redesign marketplace home (header, categories, grid, search, footer)"
```

---

## Task 5: PDV / menu page redesign + business bifurcation

**Files:**
- Create: `src/components/customer/restaurant-header.tsx`
- Create: `src/components/customer/sticky-category-nav.tsx`
- Create: `src/components/customer/product-card.tsx`
- Create: `src/components/customer/product-details.tsx`
- Modify: `src/components/customer/menu-view.tsx` (rewrite presentation; keep props `{ venue, pdv, products }` and all cart logic)

**Interfaces:**
- Consumes: `pdvSellsOnline` (Task 2), `useCart` (`@/stores/cart-store`), `PdvLogo`, `brl` (`@/lib/utils`), types `Pdv`/`Product`.
- Produces:
  - `RestaurantHeader({ venue, pdv })`
  - `StickyCategoryNavigation({ categories, active, onSelect })`
  - `ProductCard({ product, sellsOnline, qty, onAdd, onRemove, onOpen })` + `ProductSection({ title, children })`
  - `ProductDetails({ product, sellsOnline, qty, onAdd, onRemove, onClose })`

- [ ] **Step 1: RestaurantHeader**

Create `src/components/customer/restaurant-header.tsx`: green-gradient header with back button (`<Link href={`/${venue}`}>`, `aria-label`), `PdvLogo`, name in `.mafood-restaurant-title`, `RestaurantStatus`-style open/closed, and `prep_time_min`/`category` meta. `pt-safe`, sticky-safe height.

- [ ] **Step 2: StickyCategoryNavigation**

Create `src/components/customer/sticky-category-nav.tsx`: horizontal pills, sticky under the header, active pill highlighted (`bg-mafood-primary text-white`), inactive `border-mafood-border text-mafood-text-secondary`. `onSelect(cat)` → smooth-scroll to `#<cat>`. Optionally sync active on scroll via `IntersectionObserver`.

- [ ] **Step 3: ProductCard + ProductSection**

Create `src/components/customer/product-card.tsx`. Light card `rounded-mafood-lg border border-mafood-border shadow-mafood-sm`, content left / image right (88px, rounded, `PdvLogo`-style fallback for missing image), name in `.mafood-product-title`, 2-line clamped description, price emphasized in `text-mafood-primary`. Disabled (`status !== "active"`) → reduced opacity + status label.
- If `sellsOnline`: show add/stepper controls (`onAdd`/`onRemove`, `qty`) exactly mirroring current `menu-view.tsx:120-158` behavior, plus tap opens details (`onOpen`).
- If not `sellsOnline`: no add controls; whole card taps to `onOpen`.

- [ ] **Step 4: ProductDetails bottom sheet**

Create `src/components/customer/product-details.tsx`: fixed bottom sheet, backdrop `bg-black/40 backdrop-blur-sm`, wide image, close button + Escape, name/price/full description. If `sellsOnline`, a quantity control + primary "Adicionar" button (wired to `onAdd`); else a note "Pagamento direto no balcão do PDV". Focus first control on open; restore on close; scroll-lock.

- [ ] **Step 5: Rewrite `MenuView` with bifurcation**

Rewrite `menu-view.tsx` presentation: compute `const sellsOnline = pdvSellsOnline(pdv);`. Render `RestaurantHeader` → (if `!sellsOnline`) a banner "Pagamento direto no balcão do PDV" → `StickyCategoryNavigation` → `ProductSection` per category with `ProductCard`s → `ProductDetails` for the open product.
- Keep the `useCart` wiring, `qtyOf`, categories derivation, and the floating cart bar + checkout link **only when `sellsOnline`**. When `!sellsOnline`, do not render the cart bar, add buttons, or checkout link at all.

Acceptance: a Bebidas PDV behaves exactly as today (cart → checkout → Asaas). A non-Bebidas PDV shows the full menu with prices, the counter-payment banner, and no path to checkout.

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run build`. Then `npm run dev`: open a Bebidas PDV → add items → floating bar → checkout reachable. Open a non-Bebidas PDV → prices visible, banner shown, no add buttons, no cart bar. Category pills scroll to sections. Details sheet opens/closes via Escape. No overflow at 320/390/430px.

- [ ] **Step 7: Commit**

```bash
git add src/components/customer/restaurant-header.tsx src/components/customer/sticky-category-nav.tsx src/components/customer/product-card.tsx src/components/customer/product-details.tsx src/components/customer/menu-view.tsx
git commit -m "feat(client): redesign PDV menu + Bebidas-only ordering bifurcation"
```

---

## Task 6: Restyle checkout, orders, account, login

**Files (presentation only — no logic changes):**
- Modify: `src/components/customer/checkout-view.tsx`
- Modify: `src/components/customer/order-tracker.tsx`
- Modify: `src/components/customer/orders-history-view.tsx`
- Modify: `src/components/customer/account-view.tsx`
- Modify: `src/components/customer/bottom-nav.tsx`
- Modify: `src/components/customer/identify-modal.tsx`
- Modify: `src/components/customer/login.tsx`

**Interfaces:** none new — all props, state, handlers, API calls, and the Asaas Pix/card flow stay byte-for-byte identical. Only class names / markup structure change.

- [ ] **Step 1: Map the dark tokens to maFood tokens**

For each file, replace `somma-*` / dark utilities with the maFood equivalents:
`bg-somma-bg`→`bg-mafood-background`, `bg-somma-surface`/`surface2`→`bg-mafood-surface`/`bg-mafood-surface-strong`, `border-somma-border`/`border-white/10`→`border-mafood-border`, `text-white`→`text-mafood-text-primary`, `text-somma-muted`→`text-mafood-text-secondary`, `bg-somma-orange`→`bg-mafood-accent` (primary actions) or `bg-mafood-primary` (brand), `text-somma-orange`→`text-mafood-primary`, `text-somma-red`→`text-mafood-accent-dark`, `text-somma-green`/`bg-somma-green`→`text-mafood-success`/`bg-mafood-success`, `rounded-client`→`rounded-mafood-md`, display headings → `.mafood-display`. Remove `somma-grain`.

- [ ] **Step 2: Apply per file, building after each**

Do the files one at a time; after each run `npm run build` to catch a broken class or JSX edit early. Keep every `onClick`, `useState`, `fetch`, QR/Pix rendering, and validation exactly as-is.

- [ ] **Step 3: Bottom nav**

Update `bottom-nav.tsx` icons/labels to maFood tokens; active tab `text-mafood-primary`, inactive `text-mafood-text-muted`. Keep the same routes/links.

- [ ] **Step 4: Verify the Asaas flow end-to-end**

Run: `npm run lint && npm run build`. Then `npm run dev`: from a Bebidas PDV complete a Pix checkout → QR renders, order tracker shows; and a card checkout → succeeds/pends as before. Login + identify modal work. History + account render in the new theme.

- [ ] **Step 5: Commit**

```bash
git add src/components/customer/checkout-view.tsx src/components/customer/order-tracker.tsx src/components/customer/orders-history-view.tsx src/components/customer/account-view.tsx src/components/customer/bottom-nav.tsx src/components/customer/identify-modal.tsx src/components/customer/login.tsx
git commit -m "feat(client): restyle checkout, orders, account and login to maFood theme"
```

---

## Task 7: States, accessibility, responsiveness, performance, cleanup

**Files:** any customer component needing polish; `src/app/globals.css` (remove dead `theme-client`/`somma-grain` client-only rules if unused elsewhere — grep first).

- [ ] **Step 1: Audit states**

Confirm each list/section has loading skeleton, empty, and error states wired (`ui/mafood-states.tsx`). Add any missing (marketplace grid empty, search no-results, menu empty category).

- [ ] **Step 2: Accessibility pass**

Verify: every interactive element is a real `<button>`/`<a>`; images have `alt`; inputs have labels/`aria-label`; drawer + product sheet manage focus and close on Escape; visible focus rings; touch targets ≥44px. Fix violations.

- [ ] **Step 3: Performance**

Where `<img>` is used for product/PDV images, ensure `loading="lazy"` (except first fold), explicit sizing to avoid layout shift, and a fallback for missing images. Do not add giant unoptimized images. Confirm no console warnings.

- [ ] **Step 4: Dead style cleanup**

Grep for `somma-grain`, `theme-client`, and any `somma-*` usage left in `src/components/customer/**` / `src/app/(client)/**`. Remove leftovers. Do NOT remove `somma-*` from `tailwind.config.ts` (admin may still reference it — grep to confirm before touching).

- [ ] **Step 5: Verify + commit**

```bash
npm run lint && npm run build
git add -A
git commit -m "chore(client): states, a11y, performance polish and dead-style cleanup"
```

---

## Task 8: Final validation

- [ ] **Step 1: Full gate**

Run: `npm test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 2: Manual matrix**

In `npm run dev`, walk the checklist at 320 / 390 / 430 / tablet / desktop:
- No horizontal overflow anywhere.
- Header sticky without layout jump; safe-area respected.
- Marketplace: categories scroll, grid real status + selos, search works, footer real links.
- Bebidas PDV: menu → cart → Pix + card checkout → order tracker (Asaas intact).
- Non-Bebidas PDV: menu + prices + counter-payment banner, no cart/checkout.
- Drawer + product sheet: keyboard + Escape + focus restore.
- Console clean; no broken images/links.

- [ ] **Step 3: Report**

Summarize: files created/modified, components implemented, functionality preserved (Asaas, cart, auth, routes), a11y + performance improvements, and lint/build/test results. Note any real remaining gaps (e.g. product search, banners admin source) as phase-2 suggestions.

---

## Self-Review

**Spec coverage:** §4 business rule → Task 2 + Task 5. §5 tokens/fonts → Task 1. §6 components → Tasks 3–5. §7 screens → Tasks 4–6. §8 states/a11y/perf → Task 7. §11 validation → Task 8. Carousel/promo (§6, hidden) → intentionally not built (no data; documented). Product search (§7.2) → intentionally deferred (documented as phase-2). No uncovered requirement.

**Placeholder scan:** Foundation tasks (1–3) carry full code. Screen tasks (4–6) give exact files, props/interfaces, data sources (with file:line references to existing logic to mirror), and acceptance criteria rather than full final markup — deliberate for a large visual redesign with no RTL infra, so the gate is build + manual verification. No "TBD/handle edge cases" left.

**Type consistency:** `pdvSellsOnline(pdv: { category?: string | null })` used identically in Task 2 (helper + guard) and Tasks 4–5. `PdvCardData` and `MarketplaceView`/`MenuView` prop shapes preserved verbatim from the existing files. `sellsOnline`, `qty`, `onAdd`, `onRemove`, `onOpen`, `onClose` prop names consistent across `ProductCard`/`ProductDetails`.
