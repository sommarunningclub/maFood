# Relatório de Prontidão Operacional 360 — maFood / Somma Food

**Data:** 2026-07-18
**Contexto:** auditoria antes/durante o go-live com clientes reais comprando pelo app (evento Somma Special Day).
**Stack:** Next.js 14.2.18 (App Router) · Supabase (schema `mafood`, service-role) · Asaas (PIX/cartão, produção) · Vercel · domínio `food.sommaclub.com.br`.
**Método:** 5 auditorias paralelas (fluxo cliente, sistema PDV, pagamentos/webhook, Supabase/segurança, escala) + verificações ao vivo em produção/Asaas/Supabase.

Legenda de status: ✅ RESOLVIDO · 🔴 ABERTO (bloqueador) · 🟠 ABERTO (alto) · 🟡 ABERTO (médio) · 🟢 OK

---

## 1. Veredito atual

**Parcialmente pronto.** Os dois maiores riscos da auditoria foram eliminados nesta sessão (exposição do banco e confirmação de pagamento). **Ainda há 2 bloqueadores de correção antes de operar com volume/estoque limitado:** oversell de estoque e cliente cobrado sem pedido (cartão).

O pipeline de pagamento online **está comprovadamente funcionando** de ponta a ponta.

---

## 2. Verificado AO VIVO (evidências)

| Item | Resultado |
|---|---|
| Rotas de produção (cardápio, checkout, histórico, painel PDV) | ✅ HTTP 200, 200–500ms |
| Asaas | ✅ **Produção real** (`api.asaas.com/v3`), conta *SOMMA EMPREENDIMENTOS ESPORTIVOS LTDA*, chave válida, simulado desligado |
| Endpoint webhook `/api/webhooks/asaas` | ✅ valida token (sem token → 401; token correto → 200) |
| Webhook no painel Asaas | aponta para `mafood-zeta.vercel.app` (alias de produção, funciona); conta Asaas é **compartilhada** com outros apps Somma |
| Confirmação de pagamento (webhook) | ✅ **PROVADO** — ver §3 |
| Pedidos "pending" antigos (8) | ✅ **não é bug** — todos PENDING/OVERDUE também no Asaas (carrinhos abandonados) |
| Supabase | 1 venue, 4 PDVs, 80 produtos (67 ativos), índices presentes nos caminhos quentes |
| Repasse aos PDVs | **sem split** no Asaas — 100% cai na conta única; repasse manual (confirmar se intencional) |

---

## 3. ✅ Resolvido nesta sessão

### 3.1 Exposição do banco via RLS/anon (era 🔴 BLOQUEADOR #1) — FECHADO
- **Problema:** policies RLS permissivas (`using(true)`/`with check(true)`) + `grant ... to anon`. Com a chave pública `sb_publishable_…` dava para **ler todos os CPFs/pedidos/saldos** e **inserir pedido `status='paid'` forjado** (fraude/comida grátis). Provado ao vivo.
- **Correção (SQL Editor):**
  ```sql
  revoke all privileges on all tables    in schema mafood from anon, authenticated;
  revoke all privileges on all sequences in schema mafood from anon, authenticated;
  revoke all privileges on all functions in schema mafood from anon, authenticated;
  revoke usage on schema mafood from anon, authenticated;
  alter default privileges in schema mafood revoke all on tables    from anon, authenticated;
  alter default privileges in schema mafood revoke all on sequences from anon, authenticated;
  alter default privileges in schema mafood revoke all on functions from anon, authenticated;
  ```
- **Verificado:** chave pública agora dá `42501 permission denied for schema mafood` em tudo (read e insert); `service_role` (o app) segue lendo normal; produção segue 200.
- **Manter:** o app usa **exclusivamente** `service_role`. NUNCA instanciar client Supabase no browser nem usar a anon key. Migrations novas em `mafood` NÃO devem `grant ... to anon`.

### 3.2 Confirmação de pagamento por webhook (era 🔴 BLOQUEADOR #4) — PROVADO FUNCIONANDO
Pagamentos PIX reais no **Somma Bar** completaram o ciclo:

| Pedido | Método | Status | Asaas | Pago |
|---|---|---|---|---|
| #1105 | pix | delivered | RECEIVED | 12:28 |
| #1104 | pix | delivered | RECEIVED | 12:27 |
| #1101 | pix | delivered | RECEIVED | 12:23 |
| #1100 | pix | delivered | RECEIVED | 12:21 |
| #1098 | pix | paid | RECEIVED | 12:20 |
| #1099 | pix | partial | RECEIVED | 12:18 |

**Cliente paga → Asaas recebe → webhook confirma → pedido vira "pago" sozinho.** Token bate, webhook chega, atualiza o pedido. (Ressalva remanescente: falta **rede de reconciliação** — se um webhook falhar/atrasar uma vez, o pedido fica em `pending`. Ver §5.)

### 3.3 DOPA HMINA — pagamento pelo app não funcionava — CORRIGIDO
- **Causa raiz:** o PDV estava com `pay_at_counter = true`, o que trava o checkout em "pagar na tenda" e esconde PIX/cartão (`checkout-view.tsx:58,150`). Todos os pedidos dele eram `method=counter`, sem cobrança online.
- **Correção:** `pay_at_counter = false` (o PDV já tinha `sells_online = true`). Agora o checkout oferece PIX/cartão como os outros. Mudança de config, sem deploy.
- **Estado atual:** `is_open=true, is_visible=true, sells_online=true, pay_at_counter=false` → live.

---

## 4. 🔴 Bloqueadores AINDA ABERTOS (corrigir antes de volume/estoque limitado)

### 4.1 Oversell de estoque
Apontado por 4 das 5 auditorias. `src/lib/stock.ts` faz decremento *ler→calcular→gravar* **não-atômico e sem lock**; pedidos `pending` (pix/counter) **não reservam estoque**. No pico, N clientes pedem "as últimas unidades" ao mesmo tempo, todos passam no `validateStock` → **vende o mesmo item várias vezes**. Também: transição→`paid` sem compare-and-set (`.eq("status","pending")`) pode **decrementar 2×** sob webhooks concorrentes.
**Fix:** decremento atômico condicional em SQL/RPC: `update products set stock_quantity = stock_quantity - :qty where id = :id and stock_quantity >= :qty` (0 linhas = sem estoque); guardar a transição→paid com `.eq("status","pending")` e só decrementar se afetou 1 linha.

### 4.2 Cliente cobrado sem pedido (cartão)
`src/app/api/customer/orders/route.ts` — no cartão a cobrança é **capturada antes** de gravar `orders`/`order_items`; sem `export const maxDuration` (timeout padrão 10s no plano Hobby) a função pode morrer **depois de cobrar, antes de salvar** → cliente pago, sem pedido, sem estorno. O rollback atual só cobre falha no insert de itens (não o crash pós-captura).
**Fix:** gravar `orders` (pending) **antes** da chamada Asaas; `maxDuration=30/60` (exige plano Pro); em falha pós-captura, `refundPayment` compensatório.

---

## 5. 🟠 Altos (mitigar antes/durante o evento)

- **Reconciliação de pagamento ausente:** se um webhook falhar/atrasar 1 vez, o dinheiro entra e o pedido trava em `pending` para sempre (a tela PIX só faz polling do status no banco, ninguém consulta `getPayment`). **Fix:** cron/rota que varre `orders` pendentes com `asaas_payment_id` e chama `getPayment` para reconciliar.
- **Entregar/marcar pago pedido NÃO pago:** `orders/[id]/deliver` e `PATCH orders/[id]` não validam transição de estado → operador marca "entregue"/"pago" sem pagamento confirmado. **Fix:** máquina de estados (exigir `status ∈ {paid,preparing,ready,partial}` antes de entregar).
- **Sem rate limiting (nenhum):** PIN do lojista tem **4 dígitos + slug público, sem bloqueio** (brute-force); `/api/customer/lookup` e `/api/pdv/customers/lookup` devolvem **nome/e-mail/telefone por CPF sem auth** (enumeração de PII / LGPD). **Fix:** rate-limit por IP no middleware + PIN 6 dígitos + lockout.
- **Escala — não aguenta centenas de simultâneos como está:** cardápio/marketplace 100% `force-dynamic` + `no-store` (toda visita = 3 queries sem cache de CDN) e polling de status a cada 4s. Quebra na camada PostgREST/Postgres. **Fix:** `export const revalidate = 20–30` em `[venue]/page.tsx` e `[venue]/[pdv]/page.tsx` (corta ~99% das leituras de catálogo); polling 4s→12–15s; confirmar plano Vercel Pro + Supabase.
- **Repasse manual:** sem split/wallet no Asaas → 100% na conta única, repasse manual aos restaurantes. **Confirmar se é intencional.**

---

## 6. 🟡 Médios (conhecer)

- Cupom de 100% (total 0) é rejeitado no checkout.
- CPF sem validação de dígito verificador (aceita `00000000000` em `counter`).
- Cartão recusado pós-análise de risco fica preso em `pending` (sem evento de recusa mapeado).
- Contador de cupom `used` com corrida (não-atômico); cupom consumido em PIX abandonado.
- Comparação de token do webhook não é timing-safe; `isValidWebhookToken` falha ABERTO se token não estiver setado (seguro na config atual, pois está setado).
- Webhook não confere valor pago vs. total do pedido; cobertura parcial de chargeback (estorno/chargeback nunca devolvem estoque).
- Sem CHECK de não-negatividade em colunas monetárias; `orders.number` sem UNIQUE constraint.
- Duas linhagens de schema divergentes (`supabase/migrations/*` vs `setup_mafood_schema.sql`) — risco de drift; consolidar.

---

## 7. Por área (resumo das auditorias)

- **Fluxo do cliente:** 🟢 preço/total à prova de forja (servidor autoritativo), PDV fechado/produto pausado/carrinho vazio barrados, reconcile de carrinho OK, webhook sempre 200. 🔴 oversell, cobrado-sem-pedido. 🟠 sem idempotência (retry de rede = cobrança/pedido duplicado), enumeração de CPF.
- **Sistema PDV:** 🟢 **sem IDOR entre PDVs** (autorização sólida — todas as 17 rotas checam dono), reembolso à prova de duplicação (compare-and-set), cookie JWT httpOnly/sameSite. 🟠 PIN sem rate-limit, entregar pedido não pago. 🟡 lookup de cliente cross-tenant.
- **Pagamentos/Asaas:** 🟢 produção real, forjar "pago" bloqueado (token), transição→paid idempotente no reenvio normal, handler resiliente (200), refund com trava. 🟠 sem reconciliação, idempotência sem UPDATE condicional. ✅ confirmação por webhook **provada**.
- **Supabase/segurança:** ✅ exposição anon **fechada**. 🟢 service_role só no servidor, integridade (FKs, constraints, índices) saudável, total recalculado no servidor. 🟡 CPF em texto puro, sem CHECK monetário.
- **Escala:** 🔴 sem cache no storefront + polling 4s. 🟠 sem rate-limit, criação de pedido com 3 chamadas Asaas sequenciais sem `maxDuration`. 🟢 número de pedido via sequence Postgres (safe), índices presentes.

---

## 8. Plano de ação priorizado

| # | Ação | Status |
|---|---|---|
| 1 | `revoke ... from anon` no Supabase (exposição do banco) | ✅ **FEITO** |
| 2 | Provar confirmação de pagamento (PIX real) | ✅ **FEITO** (funciona) |
| 3 | Estoque atômico + gravar pedido antes de cobrar cartão + `maxDuration` | 🔴 pendente |
| 4 | `revalidate` no cardápio + polling mais lento (aguentar o pico) | 🟠 pendente |
| 5 | Rate-limit (middleware) + PIN 6 díg + máquina de estados no `deliver` | 🟠 pendente |
| 6 | Reconciliação de pagamento (cron `getPayment`) | 🟠 pendente |

---

## 9. Notas de deploy / código

- **Produção** roda o commit `29860ae`. Mudanças locais **não deployadas**: `fa95e57` (sacola na home + regra "1 restaurante por vez") e o fix do dashboard admin (`products-view.tsx` — "Previsão de venda" passa a usar `effectivePrice`/preço de venda em vez do "Preço" base). Nenhuma delas afeta os bloqueadores acima.
- As correções desta sessão (RLS revoke, DOPA `pay_at_counter`) são **dados/config no banco** — já valem em produção, sem deploy.
- ⚠️ **Não** redirecionar o venue-root (`/somma-special-day`) para `/`: `/` já redireciona para o venue, então isso cria loop e derruba o site.
