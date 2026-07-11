# maFood — Redesign do cliente + venda só de bebidas no app

**Data:** 2026-07-10
**Escopo:** camada de apresentação das telas do cliente + uma mudança de regra de negócio (roteamento de pagamento por PDV). Sem tocar em admin/PDV, backend, schema de pedidos, autenticação ou contratos de API além do necessário.

---

## 1. Objetivo

1. **Regra de negócio:** apenas PDVs de **Bebidas** vendem e cobram dentro do maFood (fluxo Asaas atual). Os demais PDVs viram **somente cardápio** — o cliente vê itens, fotos, descrições e preços, com aviso de que o pagamento é no balcão do PDV. Sem carrinho/checkout para esses.
2. **Redesign visual:** transformar as telas do cliente num app mobile-first sofisticado, acolhedor e consistente, seguindo a direção do spec (tema claro/creme, teal + coral, Merriweather + DM Sans), **sem quebrar nenhuma funcionalidade existente**.

Admin e painel PDV permanecem no tema escuro atual e fora de escopo.

---

## 2. Diagnóstico da arquitetura atual

- **Stack:** Next.js 14.2 (App Router), React 18, Tailwind 3.4, Supabase (`@supabase/ssr`), React Query, Zustand, Framer Motion + GSAP, `lucide-react`. PWA via Serwist.
- **Tema atual:** escuro. Cliente usa tokens `somma-*` (`tailwind.config.ts`) + classe `theme-client` + `somma-grain`; admin usa `palantir-*`. Fonte display uppercase (Barlow).
- **Rotas do cliente** (`src/app/(client)/`): `layout.tsx` (shell + bottom nav), `[venue]/page.tsx` (marketplace), `[venue]/[pdv]/page.tsx` (cardápio), `[venue]/checkout`, `[venue]/history`, `[venue]/order/[orderId]`, `[venue]/account`, `[venue]/login`.
- **Componentes do cliente** (`src/components/customer/`): `marketplace-view`, `menu-view`, `checkout-view`, `order-tracker`, `orders-history-view`, `account-view`, `bottom-nav`, `customer-header`, `identify-modal`, `login`, `instagram-chip`, `pizza-loader`.
- **Modelo `Pdv`** (`src/types/index.ts`): tem `category: string` (livre). Não há campo que distinga PDV vendedor de PDV só-cardápio → **usaremos `category === "Bebidas"`** como regra, centralizada num helper.
- **Pagamento:** Asaas (`src/lib/asaas.ts`), Pix/cartão, por pedido; carrinho por PDV (`cart-store`, com `pdvId`). Criação de pedido nas rotas `src/app/api/customer/...` / `pdv`.
- **Riscos de regressão:** (a) trocar tema global quebraria admin/PDV; (b) mexer no `cart-store`/checkout pode quebrar Asaas; (c) o bottom-nav e o safe-area são compartilhados por todas as telas do cliente.

---

## 3. Abordagem escolhida

**Design system novo escopado ao cliente.** Introduzir tokens `--mafood-*` e utilitários num bloco CSS aplicado sob uma classe raiz `.mafood-shell` (no `(client)/layout.tsx`). O tema escuro do admin/PDV (`somma-*`/`palantir-*`) fica intocado. Extensão do `tailwind.config.ts` com cores semânticas `mafood.*` para uso como utilitários. Fontes novas via `next/font/google` só com os pesos usados.

Rejeitadas: (B) troca global de tema — quebra admin; (C) CSS Modules paralelos — o projeto é Tailwind-consolidado, o spec pede não bifurcar a arquitetura.

---

## 4. Regra de negócio: roteamento de pagamento

### 4.1 Helper central
Criar `src/lib/pdv.ts`:

```ts
/** PDV vende e cobra dentro do maFood (fluxo Asaas). Hoje: só categoria "Bebidas". */
export function pdvSellsOnline(pdv: { category?: string | null }): boolean {
  return (pdv.category ?? "").trim().toLowerCase() === "bebidas";
}
```

Uma única fonte de verdade — se a regra mudar (ex.: virar um toggle no admin), muda só aqui.

### 4.2 Comportamento no cliente
- **PDV Bebidas** (`pdvSellsOnline === true`): cardápio completo com add/remover, barra flutuante de carrinho, checkout, order-tracker. **Fluxo Asaas 100% preservado.** Selo no card do marketplace: "Pedir & pagar aqui".
- **PDV só-cardápio** (`false`): cardápio com itens/fotos/descrições/preços, **sem** botões de adicionar, **sem** barra de carrinho, **sem** rota de checkout acessível. Banner fixo no topo do cardápio: "Pagamento direto no balcão do PDV". Selo no card do marketplace: "Cardápio".

### 4.3 Guarda no servidor (defesa em profundidade)
Na rota que cria pedido do cliente, rejeitar (HTTP 422) pedidos cujo PDV não passe em `pdvSellsOnline`. Impede pedido forjado por PDV que não cobra no app. Nenhuma mudança de contrato para o fluxo legítimo (Bebidas).

### 4.4 Preservação
`cart-store`, `checkout-view`, `asaas.ts`, webhooks, schema de `orders`, cupons — **inalterados na lógica**. O redesign do checkout é só visual.

---

## 5. Design system (`--mafood-*`)

Bloco em `globals.css` escopado a `.mafood-shell` com os tokens do spec (paleta teal/coral/gold, cremes, textos, `--mafood-border`, sombras `sm/md/lg`, raios `sm..pill`, `--mafood-space-page`). Classes-assinatura:

- `.mafood-section-title` — Merriweather itálico 700, cor `--mafood-section-title` (verde). Assinatura visual das seções.
- `.mafood-display`, `.mafood-restaurant-title`, `.mafood-product-title` — Merriweather.
- Corpo/botões/badges/nav — DM Sans.

`tailwind.config.ts`: adicionar `colors.mafood.*` (primary, accent, gold, success, background*, surface*, text*, border) apontando para os mesmos valores, e `fontFamily.serif`/`fontFamily.dmsans` para as duas famílias. Bloco `prefers-reduced-motion` global (spec) em `globals.css`.

**Fontes:** `next/font/google` — Merriweather (700, 700 italic) e DM Sans (400, 500, 600, 700). Aplicadas via variáveis CSS no `.mafood-shell`. Barlow/Jakarta/Inter/Plex permanecem para o admin.

---

## 6. Componentes (novos e redesenhados)

Todos em `src/components/customer/`. Pequenos, previsíveis, reutilizáveis. Estados obrigatórios: loading (skeleton), erro, vazio, sem-imagem, indisponível, aberto/fechado.

| Componente | Papel |
|---|---|
| `MaFoodHeader` | Header sticky: gradiente verde + textura CSS, logo maFood, busca em destaque, botão menu (alvo ≥44px), `pt-safe`, sem layout shift. |
| `MaFoodMenuDrawer` | Drawer lateral: backdrop blur, animação suave, fecha por botão/backdrop/Escape, focus-trap, scroll-lock, restaura foco. Só itens reais (Praça, Meus pedidos, Conta, Sair). |
| `MaFoodSearch` + `SearchModal` | Campo elevado (fundo claro, ícone, placeholder, foco, limpar, teclado, a11y). Busca **client-side sobre PDVs + categorias + tipo de culinária** (dados já carregados). Produtos ficam fora por ora. |
| `SectionHeading` | Título de seção serif itálico verde. |
| `HorizontalCategoryList` + `CategoryCard` | Scroll horizontal com snap, imagem/overlay, nome Merriweather, sombra esverdeada, tap-scale, estado ativo; filtra a grade. |
| `RestaurantGrid` + `RestaurantCard` + `RestaurantStatus` + `CategoryBadge` | Cards claros, logo circular, status real aberto/fechado, badge categoria, selo Bebidas/Cardápio, feedback de toque. |
| `HeroCarousel` + `CarouselDots` | Prontos, mas **só renderizam com dado válido** — sem fonte hoje, ficam ocultos (sem mock). |
| `PromotionCarousel` + `PromotionCard` | Idem — ocultos sem dado. |
| `RestaurantHeader` | Cabeçalho da página do PDV: voltar, gradiente, nome serif, logo, status, tempo/categoria. |
| `StickyCategoryNavigation` | Pills sticky com scroll, categoria ativa por seção visível, scroll suave ao tocar. |
| `ProductSection` + `ProductCard` | Cards claros/elevados, imagem à direita, preço destacado, badges, estados. |
| `ProductDetails` | Bottom sheet: imagem ampla, descrição completa, quantidade, fechar/Escape, backdrop blur. |
| `MaFoodFooter` | Card gradiente verde, logo, **só links/redes/infos reais**. |
| `EmptyState` / `ErrorState` / `LoadingSkeleton` | Estados compartilhados coerentes com o layout final. |

Componentes existentes redesenhados no lugar (lógica preservada): `checkout-view`, `order-tracker`, `orders-history-view`, `account-view`, `bottom-nav`, `identify-modal`, `login`.

---

## 7. Telas

### 7.1 Shell (`(client)/layout.tsx`)
Troca `theme-client somma-grain` por `.mafood-shell` (fundo creme, fontes novas). Mantém bottom nav e safe-area. No desktop: largura máx confortável e composição centralizada (não esticar mobile).

### 7.2 Home (`MarketplaceView`)
`MaFoodHeader` → hero editorial de **dados reais** (nome/descrição/badge do venue) → `HorizontalCategoryList` (categorias reais dos PDVs) → `RestaurantGrid` (status real, selos Bebidas/Cardápio) → `MaFoodFooter`. Busca via `SearchModal`. Carrossel/promo ocultos.

### 7.3 Página do PDV (`MenuView`)
`RestaurantHeader` → `StickyCategoryNavigation` → seções de `ProductCard` → `ProductDetails` sheet. **Bifurcação §4.2**: Bebidas mantém carrinho/checkout; só-cardápio mostra banner "Pagamento no balcão" e esconde add/carrinho.

### 7.4 Checkout / Pedidos / Conta / Login
Restyle no novo tema, **lógica intocada**: `checkout-view` (Asaas Pix/cartão), `order-tracker`, `orders-history-view` + `order/[orderId]`, `account-view` + `bottom-nav`, `login` + `identify-modal`.

---

## 8. Estados, microinterações, a11y, performance

- **Estados:** skeletons coerentes (não spinners de página inteira), empty/error, sem-imagem (fallback de logo/produto), aberto/fechado, indisponível, busca vazia/sem resultado.
- **Microinterações:** transições 160–250ms, tap-scale leve, hover só desktop, foco visível, entrada suave de cards, transição de sheets/modais. `prefers-reduced-motion` respeitado.
- **A11y:** HTML semântico, labels em campos, `alt` em imagens, navegação por teclado, foco gerenciado em modais/drawer, botões/links reais (não `div` clicável), `aria-label` onde preciso, alvos de toque ≥44px.
- **Performance:** `next/image` onde couber com `width/height` (sem layout shift), `loading="lazy"` fora da primeira dobra, `priority` só no essencial, fallback de imagem, preservar code splitting, sem warnings no console.

---

## 9. Não-objetivos / preservação

Preservados integralmente: regras de negócio, schema, contratos de API, autenticação, rotas, params de URL, carrinho, checkout, favoritos (se houver), busca existente, filtros, dados reais de PDVs/produtos, painéis admin/PDV, integrações (Asaas, Supabase, Resend). Nada de mocks. Sem renomear endpoints/tabelas/campos sem necessidade. Sem carrossel/promo com dados falsos.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vazar tema claro para admin/PDV | Tokens escopados a `.mafood-shell`; admin usa `palantir-*`. |
| Quebrar Asaas | Não tocar `cart-store`/`asaas.ts`/webhooks; checkout só restyle. |
| Overflow horizontal | Testar 320/360/375/390/414/430; `overflow-x: hidden` já no `html/body`. |
| Regra "Bebidas" frágil (string) | Centralizada em `pdvSellsOnline`; comparação normalizada (trim+lowercase). |
| Header sticky causar salto | Altura fixa, sem reflow; testar. |

---

## 11. Validação (ao final)

`npm run lint` e `npm run build` (typecheck via build do Next). Verificar manualmente: console limpo, imagens/links ok, sem overflow horizontal, header não sobrepõe conteúdo, scroll/safe-area corretos, layout em 320/390/430/tablet/desktop, drawer e sheet acessíveis por teclado, fluxo Asaas de um PDV Bebidas ainda funciona, PDV não-bebida sem carrinho.

---

## 12. Milestones (entrega única, incremental e verificável)

1. Tokens + fontes + `.mafood-shell` + `tailwind.config` + `prefers-reduced-motion`.
2. Helper `pdvSellsOnline` + guarda no servidor.
3. `MaFoodHeader` + `MaFoodMenuDrawer` + shell.
4. Home (`MarketplaceView`): categorias, grade, selos, busca, hero, footer.
5. Página do PDV (`MenuView`): header, nav sticky, cards, sheet, bifurcação de negócio.
6. Restyle checkout/pedidos/conta/login.
7. Estados, a11y, responsivo, performance, limpeza de estilos mortos.
8. Validação (lint/build) + verificação manual mobile.
