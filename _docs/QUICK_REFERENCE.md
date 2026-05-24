# maFood — Quick Reference Guide

## 🎯 Projeto em Uma Frase
Marketplace + PDV + Admin para praças de alimentação, com Pix transparente e repasse automático aos lojistas.

## 📊 By The Numbers
- **3** interfaces distintas
- **15** tabelas de banco
- **18** etapas de implementação
- **21** dias estimados
- **~40** componentes
- **~15** endpoints de API
- **400** participantes (evento Somma)

## 🏗️ Stack (memorizar)
```
Frontend: Next.js 14 App Router + TypeScript + Tailwind
UI: shadcn/ui (2 radius configs)
Forms: React Hook Form + Zod
State: Zustand + TanStack Query
Backend: Supabase PostgreSQL + Realtime
Payments: Asaas API
Deploy: Vercel
```

## 🎨 Cores (dois design systems)

### Admin (`#0A0C10-#161B22` — Palantir)
```
bg: #0A0C10
surface: #161B22
border: #30363D
text: #C9D1D9
accent: #F85149 (red) / #3FB950 (green) / #58A6FF (blue)
```

### Cliente (`#080808-#1A1A1A` — Somma)
```
bg: #080808
orange: #F26522 (ação primária)
text: #f0f0f0
accent: laranja Somma em tudo
```

## 🗂️ Pasta Structure (criar agora)
```
app/
  (public)/[venue]/        → Cliente
  pdv/[pdvId]/             → PDV
  admin/                   → Admin
  api/                     → Routes
  admin/globals-admin.css  → Tema admin
  (public)/globals-client.css → Tema cliente

components/
  ui/                      → shadcn/ui
  admin/                   → Admin-specific
  pdv/                     → PDV-specific
  customer/                → Cliente-specific
  shared/                  → Compartilhados

lib/
  supabase/                → Cliente + Server
  asaas/                   → Wrapper Asaas (6 files)
  validations/             → Zod schemas
  utils.ts

hooks/
  useOrders.ts             → Realtime
  useCart.ts               → Zustand
  usePriceEngine.ts        → Cálculo preços

stores/
  cartStore.ts             → Zustand
  orderStore.ts

types/
  index.ts                 → Todos os tipos

supabase/
  migrations/              → SQL
  seed.ts                  → Dados exemplo
```

## 💾 Database em 10 linhas
```
venues → praças
  ↓
pdvs → lojistas (1:N)
  ├→ products (1:N)
  └→ orders (1:N) ← customers (N:1)
      └→ order_items (1:N) ← products
payouts (resumo financeiro por período)
coupons (cupons desconto)
webhooks_logs (auditoria)
user_roles (RLS control)
```

## 🔐 RLS Roles (nunca esquecer)
```
superadmin        → tudo
venue_admin       → apenas seu venue_id
pdv_operator      → apenas seu pdv_id
anônimo (cliente) → read venues/products, create orders/customers
```

## 💳 Asaas Flow (7 passos)
```
1. POST /api/payments/pix
2. → POST /v3/lean/payments {billingType:'PIX', splits:[...]}
3. → GET /v3/payments/{id}/pixQrCode
4. ← Return qrcode_base64 + payload
5. ← Cliente paga no app
6. → WEBHOOK from Asaas: PAYMENT_CONFIRMED
7. ← Update order.status='paid' + Realtime event
```

## 🎮 Kanban PDV (5 colunas)
```
NOVOS → EM PREPARO → PRONTOS → ENTREGUES → CANCELADOS
(org)   (blue)       (green)   (gray)       (red)
```

## 🎯 Key Decisions
- **Duas identidades visuais:** Admin ≠ Cliente (nunca misturar)
- **RLS desde o início:** Não é retrofit
- **Realtime é critical:** PDV não funciona sem WebSocket
- **Engine precificação:** Sempre calculado, nunca armazenado
- **Split automático:** Asaas faz, não maFood
- **PWA required:** Cliente precisa offline support

## 📱 Routes (16 principais)

### Cliente
```
/[venue]
/[venue]/[pdv]
/[venue]/checkout
/[venue]/order/[orderId]
/[venue]/history
```

### PDV
```
/pdv/[pdvId]
```

### Admin
```
/admin
/admin/orders
/admin/pdvs
/admin/products
/admin/coupons
/admin/financial
```

### API
```
POST /api/orders
POST /api/payments/pix
POST /api/payments/card
POST /api/coupons/validate
POST /api/webhooks/asaas
GET /api/orders/[id]
```

## ⚡ Performance Hints
- TanStack Query v5 para caching servidor
- Zustand para cart (persistido localStorage)
- Realtime Supabase para pedidos ao vivo
- Upstash Redis para rate limiting
- Vercel Edge Functions para webhooks (fast)
- Recharts para analytics (não D3)

## 🚨 Critical Paths (não atrasar)
1. **Supabase setup** → tudo depende disso
2. **Asaas integration** → pagamento é core
3. **Realtime webhook** → PDV não funciona sem
4. **RLS policies** → nunca é tarde demais para quebrar

## 📋 Antes de Começar
- [ ] Ler `IMPLEMENTATION_PLAN.md`
- [ ] Ler `PROJECT_STATUS.md`
- [ ] Ler `REVISION_SUMMARY.md`
- [ ] Ler `README_PROJETO.md`
- [ ] Fazer setup Fase 1
- [ ] Criar Supabase project
- [ ] Gerar Asaas API keys (sandbox)

## 🎓 Learning Path (se novo)
1. Palantir design (look at reference project)
2. Next.js 14 App Router (read docs)
3. TanStack Query patterns (understand caching)
4. Supabase RLS (understand security model)
5. Asaas API docs (understand payment flow)

## 📞 Sanity Checks
- "É mobile-first?" → Cliente SIM, PDV SIM, Admin NÃO
- "Tem dark mode?" → Tudo escuro sempre
- "Onde armazena preço?" → Só `price` final, breakdown calculado
- "Quem faz split?" → Asaas (webhook)
- "Como PDV sabe novo pedido?" → Supabase Realtime
- "Precisa autenticação?" → Sim (Supabase Auth)

## 🐛 Common Pitfalls
- ❌ Misturar cores de admin + cliente
- ❌ RLS policies incompletas
- ❌ Webhook sem verificação assinatura
- ❌ Realtime disabled (depois impossível debug)
- ❌ Armazenar preço calculado (mantém dinâmico)
- ❌ Esquecer que PDV precisa tablet orientation
- ❌ Cliente sem PWA manifest

---

**Pronto para começar?** → Vá para `IMPLEMENTATION_PLAN.md` Fase 1  
**Questões?** → Veja `REVISION_SUMMARY.md` ou `README_PROJETO.md`  
**Estado atual?** → Leia `PROJECT_STATUS.md`
