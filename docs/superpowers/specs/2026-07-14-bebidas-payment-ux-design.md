# Refino do pagamento de bebidas no app

**Data:** 2026-07-14
**Escopo:** UX do pagamento in-app de bebidas (PIX + cartão via Asaas)

## Contexto

O fluxo de compra de bebidas já é totalmente funcional: carrinho (Zustand), checkout com
identificação por CPF, e pagamento via gateway **Asaas** com PIX e cartão de crédito
(`src/lib/asaas.ts`, `src/app/api/customer/orders/route.ts`). A confirmação de pagamento
chega por webhook do Asaas (`src/app/api/webhooks/asaas/route.ts`), que atualiza
`orders.status` no Supabase. O `order-tracker.tsx` já reage a isso via Supabase Realtime.

Este trabalho **não constrói pagamento novo** — refina a experiência de retorno ao usuário
durante o pagamento, conforme pedido:

1. Cartão: loading com mínimo de 3s e retorno explícito de aprovado/negado.
2. PIX: timer de expiração com efeito real, botão de copiar (já existe), e detecção
   automática do pagamento na tela com a próxima etapa (aguardar o restaurante).

Toda a mudança concentra-se em `src/components/customer/checkout-view.tsx`, reaproveitando
o padrão de Realtime de `src/components/customer/order-tracker.tsx`.

## Decisões

- Tempo de expiração do PIX: **15 minutos** (mantém o valor atual, agora com efeito).
- Próxima etapa após pagamento = **"Aguardando o restaurante aceitar seu pedido"** (o
  restaurante aceita antes de preparar).
- Detecção do PIX pago: **Realtime + polling de reforço (~4s)**.
- Cartão aprovado: **tela explícita de sucesso** antes do tracker.

## Mudanças

### 1. Cartão — loading de 3s + tela de aprovado/negado

- Em `submitOrder`, o `minDelay` passa de `1000ms` → **`3000ms`**. A tela `submitting`
  ("Processando pagamento", spinner) sempre aparece por no mínimo 3 segundos.
- Novo `Step`: `"approved"`. No sucesso do cartão (`r.ok`), em vez de rotear direto para
  o tracker, define `step = "approved"`.
- Tela `approved`: ícone verde ✓, título **"Pagamento aprovado"**, texto da próxima etapa
  **"Aguardando o restaurante aceitar seu pedido"**, e botão **"Acompanhar pedido"** que
  chama `finalize()` (limpa carrinho → rota `/${venue}/order/${orderId}`).
- **Negado**: o step `failed` já existente é mantido sem alterações (mensagem do Asaas,
  "nenhum valor foi cobrado", tentar novamente / trocar método).

### 2. PIX — detecção automática de pagamento

- Na tela do PIX, assinar Supabase Realtime na linha do pedido:
  canal `order-${orderId}`, `postgres_changes` em `{ schema: "mafood", table: "orders",
  filter: "id=eq.${orderId}" }`, revalidando o status a cada evento.
- **Polling de reforço**: `setInterval` (~4s) que faz `select status from orders where id`
  (via `@/lib/supabase/client`), cobrindo o caso do webhook chegar com a aba fora de foco.
- Ambos são limpos no unmount / ao sair do step PIX.
- Quando `status === "paid"` (ou rank além de pending), a tela troca para o estado
  **"Pagamento confirmado ✓"**: ícone verde, próxima etapa
  **"Aguardando o restaurante aceitar seu pedido"**, botão **"Acompanhar pedido"** →
  `finalize()`.

### 3. PIX — expiração real → gerar novo

- O `PixTimer` (15 min) passa a comunicar a expiração ao componente pai (via callback
  `onExpire`). Ao expirar, a tela do PIX mostra overlay **"PIX expirado"** sobre o QR e
  botão **"Gerar novo Pix"**.
- "Gerar novo Pix" chama `submitOrder()` novamente (nova cobrança no Asaas → novo QR e
  payload, timer reiniciado). O `copied` e estados de PIX são resetados.

### Refactor de apoio

`checkout-view.tsx` tem ~763 linhas. Extrair a tela do PIX para um componente próprio
`src/components/customer/pix-payment.tsx` que encapsula: exibição do QR, botão copiar,
`PixTimer`, estado de expiração, detecção de pagamento (Realtime + polling) e o estado
"pago". Recebe via props: `orderId`, `orderNumber`, `qr`, `pixPayload`, `finalTotal`,
`discount`, `onRegenerate`, `onFinalize`. A tela `approved` fica inline em
`checkout-view` (é pequena).

## Máquina de estados (Step)

```
form → card-form → submitting → approved  (cartão aprovado)
                              → failed    (cartão negado)
form → submitting → pix       (PIX gerado)
                              → (dentro de pix-payment) pago | expirado
```

## Fora de escopo (YAGNI)

- Cancelar automaticamente a cobrança PIX antiga ao gerar uma nova: a antiga fica
  `pending` no Asaas e é tratada por limpeza posterior.
- Alinhar o timer de 15 min à expiração real da cobrança Asaas: mantém-se timer
  client-side fixo.

## Testes

- Unit: lógica do `PixTimer`/expiração (contagem, callback de expiração).
- Manual/e2e: cartão aprovado mostra 3s de loading + tela de aprovado; cartão negado cai
  em `failed`; PIX pago (simular update de status) troca a tela sozinha; PIX expirado
  mostra "gerar novo" e regenera o QR.
