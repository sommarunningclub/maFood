# maFood — referência rápida

## Rotas

Cliente:

```text
/<venue>
/<venue>/<pdv>
/<venue>/checkout
/<venue>/history
/<venue>/order/<order-id>
/<venue>/account
```

PDV:

```text
/loja/<slug>/login
/loja/<slug>/pedidos
/loja/<slug>/pedidos/novo
/loja/<slug>/cardapio
/loja/<slug>/combos
/loja/<slug>/perfil
```

Admin:

```text
/admin/login
/admin/setup
/admin/dashboard
/admin/orders
/admin/pdvs
/admin/products
/admin/coupons
/admin/financial
```

Pagamento público:

```text
/pay/<order-id>
```

## Sessões

- `mafood_admin`: administrador, 12 horas.
- `mafood_pdv_session`: operador do PDV, 12 horas.
- `mafood_customer`: cliente, 30 dias.
- Todas são JWT em cookie `httpOnly`; usam `PDV_SESSION_SECRET`.

## Dados

- Schema operacional: `mafood`.
- Cliente privilegiado: `createAdminClient()`, somente servidor.
- Browser: pedidos são lidos por APIs autenticadas, não diretamente do
  Supabase.
- Catálogo e pedidos são validados no servidor antes do checkout.

## Carrinho

- Store: `src/stores/cart-store.ts`.
- Persistência versionada no `localStorage`.
- Apenas IDs, quantidade, observações, tamanho e preço conhecido são persistidos.
- `/api/customer/cart` reconcilia disponibilidade, preço e dados atuais.
- Item removido ou inativo é descartado antes do pedido.

## Pagamentos

- Pix e cartão: `src/lib/asaas.ts`.
- Webhook: `POST /api/webhooks/asaas`.
- Simulação: somente `ASAAS_ALLOW_SIMULATED=true`.
- Link de cartão: `/pay/<order-id>`.
- E-mail do link: Resend.

## Upload

- Formatos de entrada: JPEG, PNG e WebP.
- Limite: 5 MB.
- Saída: WebP, no máximo 2400 × 2400.
- Bucket: `pdv-assets`.
- Implementação: `src/lib/image-upload.ts`.

## Erros

- Implementação: `src/lib/server-errors.ts`.
- 5xx público: mensagem genérica + `request_id`.
- Log server-side: contexto, `request_id`, nome, mensagem e código.
- Nunca devolver erro bruto do Supabase ou Asaas.

## Comandos

```bash
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## Documentos atuais

- `README.md`: visão geral e setup.
- `_docs/PROJECT_STATUS.md`: estado funcional e pendências.
- `_docs/SECURITY.md`: controles e riscos conhecidos.
- `_docs/OPERATIONS.md`: banco, deploy e diagnóstico.

Os demais documentos em `_docs` são registros históricos de planejamento.
