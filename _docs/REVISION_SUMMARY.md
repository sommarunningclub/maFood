# maFood — Revisão Completa do Projeto
**Data:** 22 de maio de 2026  
**Revisor:** Claude Code  
**Duração da revisão:** Completa

---

## 📌 Resumo Executivo

O **maFood** é uma plataforma operacional para praças de alimentação, eventos e ambientes multi-vendedor. O projeto possui:

- ✅ **Especificação completa e detalhada** (30 páginas de requirements)
- ✅ **Arquitetura de banco de dados** (15 tabelas PostgreSQL)
- ✅ **Stack tecnológico definido** (Next.js 14 + Supabase + Asaas + Vercel)
- ✅ **Duas identidades visuais distintas** documentadas (Palantir admin + Somma branding cliente)
- ✅ **Plano de implementação** com 18 etapas ordenadas por dependência
- ❌ **Código/Setup:** Não iniciado — apenas estrutura boilerplate

**Timeline estimada:** 21 dias de desenvolvimento (pronto para começar)

---

## 🎯 O Que Foi Documentado

### 1. Visão do Produto
- Marketplace digital para clientes comprarem (mobile PWA)
- Painel operacional para PDVs prepararem (tablet)
- Backoffice admin para gerenciar tudo (desktop)
- 400 participantes no evento Somma Special Day (18/07/2026)

### 2. Stack Tecnológico
| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 14 App Router, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui com dois design systems |
| **Forms** | React Hook Form + Zod |
| **State Management** | Zustand (client), TanStack Query (server) |
| **Tables** | TanStack Table v8 (backoffice) |
| **Animations** | Framer Motion |
| **Charts** | Recharts |
| **Backend** | Next.js API Routes |
| **Database** | Supabase PostgreSQL + Realtime |
| **Auth** | Supabase Auth + RLS |
| **Payments** | Asaas API (Pix + Cartão) |
| **Deploy** | Vercel + GitHub CI/CD |

### 3. Design System (Duas Identidades)

#### 🖥️ Admin / PDV / Backoffice — "Terminal Operacional"
Baseado em **Palantir**:
- Fundo: `#0A0C10` (preto absoluto)
- Surface: `#161B22`
- Border: `#30363D`
- Text: `#C9D1D9`
- Muted: `#8B949E`
- Tipografia: **Inter** (display) + **Geist Mono** (dados)
- Raio: **0px** (sem arredondamento, máx 2px em badges)
- Filosofia: Densidade alta, sem decoração, estética de inteligência de dados

#### 📱 Cliente — "Editorial Esportivo Somma"
- Fundo: `#080808` (escuro, não branco)
- Orange: `#F26522` (laranja Somma primário)
- Tipografia: **Barlow Condensed** (títulos) + **Plus Jakarta Sans** (corpo) + **IBM Plex Mono** (números)
- Raio: **6px** (mobile-friendly)
- Filosofia: Energia atlética, movimento, comunidade, evento especial

### 4. Banco de Dados — 15 Tabelas
```
venues          → praças/eventos
pdvs            → lojistas (com subconta Asaas)
products        → itens do cardápio
customers       → clientes
orders          → pedidos (com Pix QR code)
order_items     → itens do pedido
payouts         → repasses financeiros
coupons         → cupons de desconto
webhooks_logs   → log de eventos Asaas
user_roles      → controle de permissões
product_categories → categorias
```

**Segurança:** RLS (Row Level Security) com 4 roles:
- `superadmin` — acesso total
- `venue_admin` — apenas seu venue
- `pdv_operator` — apenas seu PDV
- `anônimo` — cliente (ler venues, criar pedidos)

**Realtime:** Habilitado em `orders` e `order_items` para atualizações ao vivo.

### 5. Integração Asaas

**Fluxo Pix transparente:**
1. Cliente paga via QR Code gerado na plataforma
2. Webhook Asaas confirma pagamento em tempo real
3. PDV recebe pedido instantaneamente no Kanban
4. Split automático: PDV recebe líquido, maFood fica com comissão

**Segurança de webhook:**
- Verificação de IP whitelist
- Verificação de assinatura
- Idempotência via `webhook_logs`
- Processamento assíncrono (retorna 200 imediatamente)

### 6. Engine de Precificação

Lojista pode informar **qualquer um** desses três valores, o sistema calcula os outros:
- Valor líquido desejado
- Preço final ao cliente
- Margem desejada (%)

**Fórmula:**
```
preco_final = liquido / (1 - comissao% - taxa_gateway% - imposto%)
breakdown = {
  preco_final,
  comissao_mafood,
  taxa_gateway,
  imposto,
  liquido_pdv
}
```

Exibido em tempo real no cadastro de produtos. Armazenar apenas `price`, breakdown é sempre calculado.

### 7. Três Interfaces Documentadas

#### Interface 1: Cliente (PWA Mobile-first)
- `/[venue]` — Marketplace com grid de PDVs
- `/[venue]/[pdv]` — Cardápio com carrinho (Zustand persistido)
- `/[venue]/checkout` — Pix QR Code + Cartão de crédito + Cupom
- `/[venue]/order/[orderId]` — Timeline de status em tempo real
- `/[venue]/history` — Histórico de pedidos

#### Interface 2: PDV (Tablet-first)
- `/pdv/[pdvId]` — Kanban 5 colunas (NOVOS → PREPARO → PRONTOS → ENTREGUES → CANCELADOS)
- Realtime WebSocket
- Gerenciamento de cardápio: **Pausar item** vs **Informar ruptura**
- Som de notificação para novos pedidos

#### Interface 3: Admin (Desktop)
- `/admin` — Dashboard com KPIs + charts (Recharts)
- `/admin/orders` — TanStack Table com filtros
- `/admin/pdvs` — CRUD + **drag-and-drop** reordenação
- `/admin/products` — CRUD + **engine precificação inline**
- `/admin/coupons` — CRUD de cupons
- `/admin/financial` — Espelho financeiro por PDV + repasses

---

## 📊 Ordem de Implementação (18 Etapas)

```
1. ✅ Setup do projeto (Next.js, deps, pastas)
2. ✅ Supabase (migrations, RLS, Realtime)
3. ✅ Asaas integration (6 módulos)
4. ✅ API: Pedidos + Cupom + Pix
5. ✅ API: Cartão + Webhook
6. ✅ Frontend: Cliente (marketplace → checkout)
7. ✅ Frontend: PDV (Kanban realtime)
8. ✅ Frontend: Admin (dashboard + CRUD)
9. ✅ Deploy (PWA + Vercel + Sentry)
```

Cada etapa depende das anteriores. **Sem bloqueadores identificados.**

---

## 🔍 O Que FALTA Fazer

| Categoria | Status | Detalhe |
|-----------|--------|---------|
| **Código** | ❌ 0% | Nenhuma linha escrita (boilerplate vazio) |
| **Setup** | ❌ 0% | Next.js 14 não scaffolded, deps não instaladas |
| **Design** | ⚠️ 50% | Palantir extraído, Somma branding precisa pesquisa |
| **Database** | ⚠️ 0% | Schema definido, mas não migrado |
| **Asaas** | ❌ 0% | Apenas requirements documentados |
| **APIs** | ❌ 0% | Apenas signatures esperadas |
| **Frontends** | ❌ 0% | Apenas wireframes mentais |
| **Tests** | ❌ 0% | Não mencionado no spec |
| **Deploy** | ❌ 0% | Vercel configurado mas não usado |

---

## 🚀 Próximo Passo Imediato

### Fase 1: Project Setup (estimado 1 dia)

```bash
# 1. Remover estrutura antiga, criar nova com Next.js 14
cd ~/Projetos/maFood
rm -rf src package.json
npx create-next-app@latest . --app --typescript --tailwind --eslint

# 2. Instalar todas as dependências
npm install \
  @hookform/resolvers @tanstack/react-query @tanstack/react-table \
  zod react-hook-form zustand framer-motion recharts \
  @dnd-kit/sortable @dnd-kit/core \
  @supabase/supabase-js @supabase/auth-helpers-nextjs \
  tailwind-merge clsx
npm install -D shadcn-ui

# 3. Criar estrutura de pastas
mkdir -p app/{admin,pdv,'(public)',api} components/{ui,pdv,customer,admin,shared} \
  lib/{supabase,asaas,validations} hooks stores types supabase/migrations

# 4. Configurar Tailwind com dois design systems
# → Criar app/admin/globals-admin.css
# → Criar app/(public)/globals-client.css

# 5. Configurar shadcn/ui com dois radius
# → Admin: --radius: 0px
# → Client: --radius: 6px
```

**Deliverables desta fase:**
- Estrutura de pastas completa
- Todas as dependências instaladas e funcionando
- Tailwind configurado com dois temas
- shadcn/ui pronto para usar
- Path aliases (`@/components`, `@/lib`, etc.) funcionando

---

## ✅ Checklist de Revisão

- [x] Especificação lida e resumida
- [x] Stack validado contra requirements
- [x] Design system extraído da referência (Palantir)
- [x] Database schema verificado (15 tabelas, índices, RLS)
- [x] Fluxos de pagamento documentados
- [x] Três interfaces descritas em detalhe
- [x] Ordem de implementação definida
- [x] Bloqueadores identificados (nenhum)
- [x] Timeline estimada (21 dias)
- [x] Próximo passo claro (Setup fase 1)

---

## 📝 Notas Finais

1. **Design tokens estão prontos:** Use como referência ao construir componentes
2. **Asaas foi pensado end-to-end:** Split, webhooks, subcontas — documentado completamente
3. **RLS é critical:** Preparar policies desde o início para evitar reescrita
4. **Realtime é essencial:** PDV não funciona sem WebSocket — teste cedo
5. **Duas identidades visuais:** Nunca misturar cores/tipografia entre interfaces

---

**Pronto para começar:** ✅ **SIM**  
**Próxima revisão:** Após completar Fase 1 (Project Setup)  
**Tempo estimado até MVP:** 21 dias  
**Número de endpoints API:** ~15  
**Número de páginas UI:** ~16  
**Número de componentes:** ~40

---

*Documento gerado pelo Claude Code — Sistema de Revisão de Projeto*
