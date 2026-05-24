# maFood

Plataforma operacional de praças de alimentação para eventos. Três interfaces, schema dedicado, pagamento simulado por ora.

> **Evento alvo:** Somma Special Day · 18 jul 2026 · COPMDF · Brasília

## Interfaces

| Rota                          | Quem usa            | O que faz                                            |
| ----------------------------- | ------------------- | ---------------------------------------------------- |
| `/[venue]`                    | Cliente (mobile)    | Marketplace, cardápio, carrinho, checkout, tracking  |
| `/loja/[slug]`                | Operador do PDV     | Painel: pedidos (Kanban), cardápio, combos, perfil   |
| `/admin`                      | Admin do evento     | Dashboard, PDVs, produtos, cupons, financeiro        |

## Stack

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind v3
- **State:** TanStack Query (server) · Zustand (cart)
- **Backend:** Supabase Postgres + Auth + Realtime + Storage
- **Schema dedicado** `mafood` (isolado de outros sistemas no mesmo banco)
- **Auth PDV:** PIN bcrypt + cookie JWT (12h)
- **Auth cliente:** CPF lookup (lista_vip → customers) + cookie JWT (30d)
- **Pagamento:** simulado (Pix QR fake) — Asaas a integrar
- **Bundler/Deploy:** Vercel-ready

## Setup local

1. **Clonar e instalar:**
   ```bash
   git clone git@github.com:sommarunningclub/maFood.git
   cd maFood
   pnpm install
   ```

2. **Copiar `.env.example` para `.env.local`** e preencher:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...           # secreta!
   PDV_SESSION_SECRET=<gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ASAAS_API_KEY=                              # vazio = pagamento simulado
   ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
   ASAAS_WEBHOOK_TOKEN=<token combinado com o webhook do Asaas>
   ```

3. **Rodar setup do schema no Supabase** — abra o SQL Editor e cole o arquivo `supabase/setup_mafood_schema.sql` inteiro de uma vez. Depois rode também as migrations adicionais em ordem (`0003`, `0004`, `0005`).

4. **No Supabase Settings → API**, adicione `mafood` em **Exposed schemas** e em **Extra search path**.

5. **Dev:**
   ```bash
   pnpm dev
   ```

## Estrutura

```
src/
├── app/
│   ├── (client)/[venue]/        # PWA do cliente
│   ├── loja/[slug]/             # painel do PDV (sidebar + 4 seções)
│   ├── admin/                   # backoffice
│   ├── api/                     # endpoints (admin, pdv, customer)
│   ├── layout.tsx
│   └── globals.css              # 2 temas: Somma + Palantir
├── components/
│   ├── customer/                # marketplace, menu, checkout, tracking
│   ├── pdv/                     # Kanban, sidebar, login PIN
│   ├── admin/                   # PDVs, produtos, dashboard
│   └── ui/                      # button, badge, etc.
├── lib/
│   ├── supabase/{client,server,admin}.ts
│   ├── auth/{pin,session,customer-session}.ts
│   ├── pricing.ts
│   ├── storage.ts
│   └── utils.ts
├── stores/cart-store.ts          # Zustand persist
├── types/index.ts
└── middleware.ts                 # protege /loja, /pdv, /[venue]

supabase/
├── setup_mafood_schema.sql       # schema completo, idempotente
└── migrations/                   # alterações pós-setup
```

## Status atual

✅ Schema completo no Supabase (mafood)
✅ Admin: dashboard, PDVs (CRUD + PIN + drag-and-drop), produtos (CRUD + categorias + upload)
✅ PDV: login por PIN, Kanban real com Realtime, retirada parcial
✅ Cliente: login por CPF, marketplace real, cardápio real, checkout cria pedido real, tracking realtime

🔄 Em desenvolvimento:
- Painel PDV self-service (cardápio, combos, perfil)
- /admin/coupons com multi-PDV
- /admin/orders lendo Supabase real (hoje ainda mock)
- Integração Asaas real (Pix + webhook)
- PWA + service worker
- Sentry

## Avisos de segurança

- **NUNCA** commitar `.env.local`. O `.gitignore` cobre, mas verifique antes de qualquer push.
- A `SUPABASE_SERVICE_ROLE_KEY` ignora RLS. Use só no servidor (Route Handlers / Server Components).
- A `lista_vip` é exposta via view `lista_vip_publico` que omite `codigo_unico`, `status_cupom`, `quantidade_usos`.

---

Co-Authored-By: Claude Opus 4.7
