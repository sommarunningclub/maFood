# maFood — Status do Projeto

**Data da Revisão:** 2026-05-22  
**Versão:** 0.1.0  
**Status Geral:** ✅ Planejamento concluído | 🔵 Setup inicial em progresso

---

## 📋 O que foi feito até agora

### 1. ✅ Documento de Especificação Completo
- Prompt de instrução detalhado definindo a visão do produto
- Três interfaces distintas documentadas (Cliente, PDV, Admin)
- Stack tecnológico completo especificado (Next.js 14, Supabase, Asaas, Vercel)
- Design system com duas identidades visuais separadas
- Arquitetura de banco de dados PostgreSQL completa com 15 tabelas
- Engine de precificação documentada
- Fluxos de pagamento Pix e Cartão definidos
- Ordem de implementação de 18 etapas

### 2. ✅ Referência Visual — Palantir Design System
- Projeto `palantir-for-family-trips` analisado como referência
- Design system de "terminal operacional" extraído:
  - **Cores:** Fundo escuro `#0A0C10`, superfícies `#161B22`, border `#30363D`
  - **Tipografia:** Inter (display) + Geist Mono (dados)
  - **Tokens:** Raio 0-4px, espaçamento modular 4px, densidade compacta
  - **Filosofia:** Industrial, utilitário, data-first, sem decoração

### 3. ✅ Planejamento de Implementação
- `IMPLEMENTATION_PLAN.md` criado com 7 fases estruturadas
- Prioridades definidas: Setup → Backend (Supabase) → Core Libraries → Frontends → Deploy

### 4. ❌ Setup do Projeto — NÃO INICIADO
- **Status atual:** Apenas estrutura mínima criada
- `package.json` contém apenas Next.js base + React 18.2.0
- **Faltam:** Nenhuma das 20+ dependências instaladas
- Pasta `src/` possui apenas 3 arquivos iniciais (pages boilerplate)
- Nenhuma estrutura de pastas conforme especificação (`app/`, `lib/`, `components/` etc.)

---

## 📊 Checklist de Implementação

### Fase 1: Project Setup
- [ ] Create Next.js 14 app with `create-next-app` (App Router, TypeScript)
- [ ] Install all 20+ dependencies (TanStack Query, shadcn/ui, Zod, etc.)
- [ ] Configure Tailwind CSS with two design systems (admin + client)
- [ ] Set up `path aliases` in tsconfig.json
- [ ] Create folder structure per spec (`app/`, `lib/`, `components/`, etc.)
- [ ] Initialize Git hooks if needed

### Fase 2: Design System Implementation
- [ ] Create `app/admin/globals-admin.css` with admin tokens
- [ ] Create `app/(public)/globals-client.css` with client tokens
- [ ] Configure shadcn/ui with `--radius: 0px` for admin, `--radius: 6px` for client
- [ ] Import Google Fonts (IBM Plex Sans/Mono + Barlow Condensed + Plus Jakarta Sans)
- [ ] Test theme switching between two design systems

### Fase 3: Supabase Backend
- [ ] Create Supabase project
- [ ] Run all 15 table migrations
- [ ] Configure RLS policies (superadmin, venue_admin, pdv_operator, anônimo)
- [ ] Enable Realtime on `orders` and `order_items` tables
- [ ] Set up Supabase Auth (magic link or email/password)
- [ ] Create seed data (Somma Special Day venue + 5 PDVs + test users)

### Fase 4: Asaas Integration
- [ ] Set up `lib/asaas/client.ts` wrapper
- [ ] Implement `lib/asaas/payments.ts` (criar cobranças)
- [ ] Implement `lib/asaas/pix.ts` (gerar QR Code)
- [ ] Implement `lib/asaas/split.ts` (split automático por PDV)
- [ ] Implement `lib/asaas/subaccounts.ts` (criar subcontas)
- [ ] Implement `lib/asaas/webhooks.ts` (verificar assinatura)

### Fase 5: Core API Routes
- [ ] `POST /api/orders` — criar pedido com validação Zod
- [ ] `POST /api/payments/pix` — gerar QR Code transparente
- [ ] `POST /api/payments/card` — processar cartão de crédito
- [ ] `POST /api/coupons/validate` — validar código de cupom
- [ ] `POST /api/webhooks/asaas` — receber e processar webhooks
- [ ] `GET /api/orders/[id]` — consultar status do pedido

### Fase 6: Frontend — Cliente (PWA Mobile-first)
- [ ] `/[venue]` — Marketplace com grid de PDVs
- [ ] `/[venue]/[pdv]` — Cardápio com carrinho
- [ ] `/[venue]/checkout` — Pix + Cartão + Cupom
- [ ] `/[venue]/order/[orderId]` — Acompanhamento realtime
- [ ] `/[venue]/history` — Histórico de pedidos
- [ ] Implementar Zustand cart store com persistência localStorage

### Fase 7: Frontend — Painel PDV (Tablet-first)
- [ ] `/pdv/[pdvId]` — Kanban com 5 colunas
- [ ] Realtime WebSocket via Supabase
- [ ] Notificações de som para novos pedidos
- [ ] Modal de gerenciamento (pausar vs ruptura)
- [ ] Toggle aberto/fechado

### Fase 8: Frontend — Admin Backoffice (Desktop)
- [ ] `/admin` — Dashboard com KPIs + charts
- [ ] `/admin/orders` — TanStack Table com filtros
- [ ] `/admin/pdvs` — CRUD + drag-and-drop sort
- [ ] `/admin/products` — CRUD + engine precificação inline
- [ ] `/admin/coupons` — CRUD de cupons
- [ ] `/admin/financial` — Espelho financeiro + repasses

### Fase 9: Deploy & Monitoring
- [ ] PWA configuration (manifest.json, service worker)
- [ ] Vercel deployment + GitHub CI/CD
- [ ] Sentry integration para error tracking
- [ ] Environment variables setup

---

## 🎯 Próximos Passos Imediatos

### 1. **Setup do Projeto (30 min)**
```bash
cd maFood
npm init next-app@latest . --ts --app --tailwind --eslint
# Usar App Router, TypeScript, Tailwind, ESLint (todos sim)
```

### 2. **Instalar Dependências (10 min)**
```bash
npm install \
  @hookform/resolvers \
  @tanstack/react-query \
  @tanstack/react-table \
  zod react-hook-form \
  zustand framer-motion recharts \
  @dnd-kit/sortable @dnd-kit/core \
  @supabase/supabase-js @supabase/auth-helpers-nextjs \
  tailwind-merge clsx
```

### 3. **Configurar Tailwind com Dois Design Systems**
- Criar variáveis CSS separadas em dois arquivos
- Configurar `radii` diferentes por contexto
- Testar tema switching

### 4. **Estruturar Pastas conforme Spec**
- Criar subpastas em `app/` (public, pdv, admin, api)
- Criar estrutura em `components/`, `lib/`, `stores/`, etc.

### 5. **Supabase Setup**
- Criar projeto
- Rodar migrations SQL
- Configurar Auth + RLS

---

## 🔍 Observações Técnicas

### Design System
- ✅ **Referência extraída:** Palantir admin tokens → mapeados para maFood admin
- ✅ **Somma Special Day styling:** Requer pesquisa adicional (identidade visual do evento)
- 🔴 **Ação pendente:** Encontrar/extrair cores exatas e tipografia do Somma Club

### Stack Decisions
- **Next.js 14 App Router:** ✅ Confirmado (moderna e recomendada)
- **shadcn/ui com dois radius:** ✅ Possível (usar override per route)
- **Tailwind v4 (com @theme):** ⚠️ Verificar compatibilidade com shadcn/ui
- **Supabase RLS:** ✅ Arquitetura definida com 4 roles

### Banco de Dados
- 15 tabelas definidas, 8 índices críticos listados
- RLS policies documentadas
- Realtime em 2 tabelas essenciais (orders, order_items)

---

## ⏱️ Estimativa de Timeline

| Fase | Tarefas | Est. Dias | Status |
|------|---------|----------|--------|
| Setup | Projeto, deps, pastas, design system | 1 | ⏳ Pronto para começar |
| Backend | Supabase, migrations, RLS | 2 | ❌ Não iniciado |
| Asaas | Todos os 6 módulos | 2 | ❌ Não iniciado |
| API Routes | 6 endpoints principais | 2 | ❌ Não iniciado |
| Cliente | 5 rotas + cart store | 5 | ❌ Não iniciado |
| PDV | Kanban + realtime | 3 | ❌ Não iniciado |
| Admin | 6 seções completas | 5 | ❌ Não iniciado |
| Deploy | PWA + Vercel + Sentry | 1 | ❌ Não iniciado |
| **TOTAL** | 27 tarefas | **~21 dias** | |

---

## 🚀 Recomendação Imediata

**Começar agora com Fase 1 (Project Setup)**. O framework está pronto, dependências são todas conhecidas, e não há bloqueadores. Uma vez que a estrutura base estiver em pé (1 dia de trabalho), podemos proceder paralelamente com Supabase + Asaas (não têm dependência uma da outra).

---

**Próxima revisão:** Após completar Fase 1  
**Responsável:** maFood Development Team  
**Última atualização:** 2026-05-22
