# 🍽️ maFood — Plataforma Operacional de Praças de Alimentação

> Marketplace + PDV Panel + Admin Backoffice para eventos e ambientes multi-vendedor

## 📱 Três Interfaces Distintas

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📱 CLIENTE (Mobile PWA)    🖥️ PDV (Tablet)     📊 ADMIN (Desktop)
│  ─────────────────────     ────────────────     ──────────────────
│                                                     │
│  Marketplace da praça     Kanban de pedidos     Dashboard + CRUD    │
│  Carrinho + Checkout      Status em tempo real  Financeiro          │
│  Pix QR Code             Notificações som      Configurações        │
│  Histórico de pedidos     Pause vs Ruptura     Relatórios           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitetura

```
┌────────────────────────────────────────────────────────────────┐
│                        VERCEL (Deploy)                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Next.js 14 (App Router) + TypeScript                        │
│  ├─ /app/(public)/[venue]/   → Cliente (PWA mobile-first)    │
│  ├─ /app/pdv/[pdvId]/        → PDV (Kanban tablet)           │
│  ├─ /app/admin/              → Backoffice (desktop)          │
│  └─ /app/api/                → API Routes (Zod validated)    │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Tailwind CSS (2 Design Systems)  +  shadcn/ui                 │
│  ├─ Admin: Palantir (terminal operacional, raio 0px)         │
│  └─ Client: Somma (editorial esportivo, raio 6px)            │
├────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + Auth + Realtime + Storage)             │
│  ├─ 15 tables (venues, pdvs, products, orders, payouts...)    │
│  ├─ RLS Policies (4 roles: superadmin, venue_admin,...)       │
│  └─ Realtime on orders & order_items                          │
├────────────────────────────────────────────────────────────────┤
│  Asaas API (Pagamentos + Split)                                │
│  ├─ Pix QR Code transparente com webhook                      │
│  ├─ Cartão de crédito transparente                            │
│  ├─ Split automático por PDV                                  │
│  └─ Subcontas para cada lojista                               │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System — Duas Identidades Visuais

### 🖥️ Admin / PDV (Terminal Operacional)
Referência: **Palantir Foundry**

| Elemento | Valor |
|----------|-------|
| **Fundo** | `#0A0C10` (preto absoluto) |
| **Surface** | `#161B22` |
| **Border** | `#30363D` |
| **Text** | `#C9D1D9` |
| **Tipografia** | Inter + Geist Mono |
| **Border Radius** | 0px (máx 2px em badges) |
| **Filosofia** | Industrial, data-first, densidade alta |

### 📱 Cliente (Editorial Esportivo)
Identidade: **Somma Special Day**

| Elemento | Valor |
|----------|-------|
| **Fundo** | `#080808` |
| **Orange** | `#F26522` (marca Somma) |
| **Tipografia** | Barlow Condensed + Plus Jakarta Sans + IBM Plex Mono |
| **Border Radius** | 6px |
| **Filosofia** | Atlético, eventos, comunidade, energia |

---

## 🗄️ Banco de Dados (PostgreSQL)

### Tabelas Principais (15 total)

```sql
venues              ← praças/eventos (Somma Special Day)
pdvs                ← lojistas com subconta Asaas
products            ← itens do cardápio
products_categories ← organização de cardápio
customers           ← clientes do evento
orders              ← pedidos com Pix QR + status
order_items         ← itens individuais do pedido
payouts             ← repasses financeiros aos PDVs
coupons             ← cupons de desconto
webhook_logs        ← auditoria de eventos Asaas
user_roles          ← controle de permissões (RLS)
```

### Row Level Security (RLS)
- `superadmin` — acesso total a tudo
- `venue_admin` — apenas seu venue
- `pdv_operator` — apenas seu PDV (lê/atualiza pedidos + produtos)
- `anônimo` — cliente (lê venues ativas, cria pedidos/customers)

---

## 💳 Fluxo de Pagamento (Asaas)

### Pix QR Code Transparente
```
1. Cliente paga em /[venue]/checkout
   ↓
2. POST /api/payments/pix → Asaas cria cobrança com split
   ↓
3. QR Code exibido na tela, cliente escaneia no app do banco
   ↓
4. Webhook Asaas dispara PAYMENT_CONFIRMED
   ↓
5. POST /api/webhooks/asaas → atualiza order.status = 'paid'
   ↓
6. Supabase Realtime emite evento
   ↓
7. PDV recebe pedido no Kanban instantaneamente 🔔
```

### Split Automático
- **Wallet PDV:** Recebe `preco - comissao% - taxa_gateway%`
- **Wallet Mestre (maFood):** Recebe `comissao% + taxa_gateway%`
- **Cálculo:** Realizado automaticamente pela Asaas

---

## 💰 Engine de Precificação

Lojista pode informar **qualquer um** destes três valores. Sistema calcula os outros em tempo real:

| Input | Exemplo |
|-------|---------|
| **Valor Líquido Desejado** | R$ 25,00 |
| **Preço Final ao Cliente** | R$ 35,00 |
| **Margem Desejada** | 200% |

**Breakdown calculado automaticamente:**
```
Preço Final:        R$ 35,00
Comissão maFood:    R$ 5,25  (15%)
Taxa Gateway:       R$ 1,26  (3.6%)
Imposto:            R$ 0,00  (0%)
─────────────────────────────
Líquido PDV:        R$ 28,49
```

Exibido em tempo real no formulário. Nunca armazenado — sempre calculado dinamicamente.

---

## 📊 KPIs do Admin Dashboard

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  Total Vendido  │  Pedidos Hoje   │  Ticket Médio   │  Comissão Hoje  │
│   R$ 8.245,00   │      194        │    R$ 42,50     │   R$ 1.237,00   │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

Ranking de PDVs          Produto Campeão    Pico Operacional    Tempo Médio Preparo
─────────────────────    ───────────────    ─────────────────   ──────────────────
1. Smash House  45%      Combo Smash        14h: ████████       Smash: 12min
2. Beer Club    28%      (47 unidades)      15h: ███████████    Beer:  18min
3. Açaí Power   18%                         16h: █████████████  Açaí:  8min
4. Coffee Lab   6%                          17h: ██████
5. Somma Store  3%
```

---

## 🔄 Realtime Capabilities

### Supabase Realtime
- **WebSocket** em `orders` e `order_items`
- **PDV Panel:** Novos pedidos aparecem instantaneamente
- **Cliente:** Status de pedido atualiza em tempo real
- **Admin:** Tabelas de pedidos sincronizadas

### Notificações
- 🔔 Som de beep quando novo pedido chega no PDV
- 📲 Push notification do navegador (se permissão concedida)
- 🎬 Animação de entrada Framer Motion

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| **Runtime** | Node.js 24 LTS |
| **Framework** | Next.js 14 (App Router) |
| **Linguagem** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4 |
| **UI Components** | shadcn/ui (customizado com 2 radius) |
| **Forms** | React Hook Form + Zod |
| **State** | Zustand (client) + TanStack Query v5 (server) |
| **Tables** | TanStack Table v8 |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **Drag & Drop** | @dnd-kit/sortable |
| **Database** | Supabase PostgreSQL |
| **Auth** | Supabase Auth (email/magic link) |
| **Realtime** | Supabase WebSocket |
| **Payments** | Asaas API (Pix + Cartão) |
| **Files** | Supabase Storage |
| **Rate Limiting** | Upstash Redis |
| **Deploy** | Vercel (Node.js Fluid Compute) |
| **Monitoring** | Sentry |

---

## 📱 Três Interfaces — Em Detalhe

### 1️⃣ Cliente (PWA Mobile-first)

```
/[venue]                    Marketplace da praça
├─ Grid de PDVs ativos
├─ Logo, nome, categoria, tempo preparo
└─ Busca rápida de produto

/[venue]/[pdv]              Cardápio do PDV
├─ Header sticky com nome
├─ Categorias em scroll
├─ Cards de produto (imagem, preço mono)
├─ Botão + / - carrinho
└─ Badge flutuante → checkout

/[venue]/checkout           Checkout
├─ Resumo pedido
├─ Campo CPF + observações
├─ Cupom validado em tempo real
├─ Seleção método: Pix (default) | Cartão
├─ [Pix] QR Code + copia-e-cola + timer
└─ [Cartão] Formulário com máscara

/[venue]/order/[orderId]    Acompanhamento realtime
├─ Timeline: PAGO → PREPARO → PRONTO → ENTREGUE
├─ Timestamps por etapa
├─ Badge laranja pulsante quando pronto
├─ QR code de retirada
└─ Botão compartilhar acompanhamento

/[venue]/history            Histórico
└─ Últimos pedidos por CPF/tel
```

### 2️⃣ PDV Panel (Tablet-first)

```
/pdv/[pdvId]                Kanban 5 colunas (realtime)
├─ NOVOS (laranja)
│   └─ Botão "ACEITAR"
├─ EM PREPARO (azul)
│   └─ Botão "MARCAR PRONTO"
├─ PRONTOS (verde)
│   └─ Botão "ENTREGAR"
├─ ENTREGUES (cinza)
└─ CANCELADOS (vermelho)

Card de pedido:
┌─────────────────────┐
│ #0042         14:32 │  (número + hora)
│ 2x Combo Smash     │
│ 1x Refrigerante    │
│ Obs: sem cebola    │
│ R$ 67,00           │
│ [ACEITAR] [PAUSAR] │
└─────────────────────┘

Barra superior:
├─ Nome PDV + toggle Aberto/Fechado
├─ Contadores de pedidos por coluna
└─ Botão "Gerenciar cardápio"
    ├─ Toggle PAUSAR item
    └─ Botão INFORMAR RUPTURA
```

### 3️⃣ Admin Backoffice (Desktop)

```
/admin                      Dashboard
├─ 4 KPI cards
├─ Tabela pedidos recentes
├─ Analytics operacional (Recharts)
└─ Ranking de PDVs por receita

/admin/orders               TanStack Table
├─ Filtros: venue, PDV, status, data, método
├─ Colunas: #, PDV, cliente, itens, valor, método, status
└─ Ação: detalhes, cancelar

/admin/pdvs                 CRUD + Drag-n-drop
├─ Listagem com status, comissão, wallet
├─ Drag-and-drop reordenar (atualiza sort_order)
├─ Toggle inline is_open
└─ Formulário: dados, logo, comissão, conta bancária

/admin/products             CRUD com engine precificação
├─ Filtro por PDV
├─ Tabela status, preço, estoque
├─ Upload imagem (Supabase Storage)
└─ Engine precificação inline (breakdown ao vivo)

/admin/coupons              CRUD de cupons
├─ Código, tipo (% | R$), valor, min order
├─ Max uses, validade
├─ Toggle ativo/inativo inline
└─ Coluna "Usos" (counter)

/admin/financial            Espelho financeiro
├─ Por PDV:
│   ├─ Total vendido
│   ├─ Comissão maFood
│   ├─ Taxa gateway
│   └─ Saldo líquido
├─ Tabela de pedidos com breakdown
└─ Repasses: status, valor, data
```

---

## ⏱️ Timeline de Desenvolvimento

| Fase | O quê | Dias | Status |
|------|-------|------|--------|
| **1** | Setup (Next, deps, pastas, Tailwind) | 1 | ❌ Ready |
| **2** | Supabase (migrations, RLS, Auth) | 2 | ❌ Ready |
| **3** | Asaas integration (6 módulos) | 2 | ❌ Ready |
| **4** | API Routes (6 endpoints) | 2 | ❌ Ready |
| **5** | Cliente Frontend (5 rotas) | 5 | ❌ Ready |
| **6** | PDV Panel (Kanban + realtime) | 3 | ❌ Ready |
| **7** | Admin Backoffice (6 seções) | 5 | ❌ Ready |
| **8** | Deploy (PWA + Vercel + Sentry) | 1 | ❌ Ready |
| | **TOTAL** | **21 dias** | |

---

## 📚 Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `IMPLEMENTATION_PLAN.md` | Plano de implementação (18 fases) |
| `PROJECT_STATUS.md` | Status atual (o que foi feito vs não feito) |
| `REVISION_SUMMARY.md` | Revisão técnica completa |
| `README_PROJETO.md` | Este arquivo (visão geral) |

---

## 🚀 Como Começar

### 1. Setup (1 dia)
```bash
cd ~/Projetos/maFood
npx create-next-app@latest . --app --typescript --tailwind --eslint
npm install [20+ dependências]
# Criar estrutura de pastas, configurar Tailwind + shadcn/ui
```

### 2. Supabase (2 dias)
```sql
-- Criar projeto em supabase.com
-- Rodar 15 migrations (tabelas, índices, RLS)
-- Configurar Auth + Realtime
-- Criar seed data (Somma Special Day)
```

### 3. Asaas (2 dias)
```typescript
// lib/asaas/ - 6 módulos
client.ts      // wrapper base
payments.ts    // criar cobranças
pix.ts         // QR Code
split.ts       // split automático
subaccounts.ts // subcontas
webhooks.ts    // verificar assinatura
```

### 4. Começar Frontend 🎨

---

## ✅ Checklist Inicial

- [ ] Ler `IMPLEMENTATION_PLAN.md`
- [ ] Ler `PROJECT_STATUS.md`
- [ ] Ler `REVISION_SUMMARY.md`
- [ ] Iniciar Fase 1: Setup
- [ ] Criar Supabase project
- [ ] Gerar Asaas API keys
- [ ] Configurar GitHub CI/CD para Vercel

---

## 📞 Contacts (Evento Real)

**Cliente:** Somma Club  
**Evento:** Somma Special Day — 1 ano de aniversário  
**Data:** 18 de julho de 2026  
**Local:** COPMDF, Brasília  
**Participantes:** 400 (estimado)  
**PDVs Partner:** 5-8 (confirmação pendente)

---

**Status Final:** ✅ **PRONTO PARA COMEÇAR**  
**Próxima Ação:** Fase 1 — Project Setup  
**Data:** 22 de maio de 2026

*Documentação gerada por Claude Code*
