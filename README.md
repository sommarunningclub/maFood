# maFood

Plataforma operacional para praças de alimentação e eventos, com marketplace
mobile, painel do PDV, backoffice e pagamentos via Asaas.

## Superfícies

- `/<venue>`: marketplace, cardápio, carrinho e checkout do cliente.
- `/<venue>/history` e `/<venue>/order/<id>`: histórico e acompanhamento.
- `/loja/<slug>`: pedidos, cardápio, combos e perfil do PDV.
- `/admin`: dashboard, pedidos, PDVs, produtos, cupons e financeiro.
- `/pay/<id>`: link público para pagamento de pedido com cartão.

## Stack real

- Next.js 14 App Router, React 18, TypeScript strict e Tailwind CSS 3.
- Supabase PostgreSQL no schema dedicado `mafood` e Supabase Storage.
- Zustand persistido para o carrinho, com migração e reconciliação no servidor.
- JWT em cookies `httpOnly` para cliente, PDV e administrador.
- PIN e senhas com bcrypt.
- Asaas para Pix, cartão e webhooks.
- Resend para envio opcional de links de pagamento.
- Serwist para manifest e service worker.
- Vitest para testes unitários.

## Requisitos

- Node.js LTS atual.
- pnpm.
- Um projeto Supabase.
- Conta Asaas sandbox ou produção para pagamentos reais.

## Configuração local

1. Instale as dependências:

   ```bash
   pnpm install
   ```

2. Copie e preencha as variáveis:

   ```bash
   cp .env.example .env.local
   ```

   Gere `PDV_SESSION_SECRET` com:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Configure o banco.

   O ambiente usado pela aplicação é o schema `mafood`. O arquivo
   `supabase/setup_mafood_schema.sql` contém o baseline idempotente. As
   evoluções posteriores estão em `supabase/migrations/`.

   Atenção: os scripts históricos ainda contêm políticas permissivas de MVP.
   Não trate o SQL atual como baseline seguro de produção sem aplicar o
   endurecimento de RLS e privilégios descrito em `_docs/SECURITY.md`.

4. No Supabase, disponibilize o schema `mafood` ao PostgREST usado pelo cliente
   server-side e restrinja os privilégios por papel. Nunca exponha a chave
   `service_role` ao navegador.

5. Inicie:

   ```bash
   pnpm dev
   ```

## Pagamentos

- Com `ASAAS_API_KEY`, as cobranças usam o ambiente definido em
  `ASAAS_BASE_URL`.
- Sem chave, o pagamento falha de forma explícita.
- Simulação local só é ativada com `ASAAS_ALLOW_SIMULATED=true`.
- O webhook deve enviar o token configurado em `ASAAS_WEBHOOK_TOKEN`.
- Dados de cartão são encaminhados ao Asaas e não devem ser persistidos.

## Uploads

Uploads administrativos e do PDV aceitam JPEG, PNG ou WebP de até 5 MB. O
servidor valida os bytes, decodifica a imagem, limita dimensões, remove
metadados e reencoda o arquivo como WebP antes do Storage.

## Verificação

```bash
pnpm test
pnpm lint
pnpm build
```

Não execute `next dev` e `next build` simultaneamente na mesma cópia do
repositório: ambos escrevem em `.next`.

## Estrutura principal

```text
src/
├── app/                         rotas, layouts e Route Handlers
├── components/
│   ├── customer/                experiência do cliente
│   ├── pdv/                     operação do lojista
│   └── admin/                   backoffice
├── lib/
│   ├── auth/                    sessões e PIN
│   ├── supabase/                cliente server-side service_role
│   ├── image-upload.ts          processamento seguro de imagens
│   ├── server-errors.ts         erros públicos e logs internos
│   └── asaas.ts                 integração de pagamentos
├── stores/cart-store.ts         carrinho persistido e reconciliado
└── types/

supabase/
├── setup_mafood_schema.sql      baseline do schema dedicado
└── migrations/                  evoluções incrementais
```

## Estado atual

- Admin dashboard, financeiro, pedidos, PDVs, produtos e cupons usam dados
  reais do Supabase.
- Checkout revalida produtos, preços, disponibilidade e cupons no servidor.
- Acompanhamento do cliente consulta uma API autenticada; o navegador não lê
  pedidos diretamente do Supabase.
- O painel PDV atualiza pedidos por uma API autenticada, sem leitura direta das
  tabelas no navegador.
- PWA e service worker estão configurados.

Limitações de segurança ainda abertas, fora deste conjunto de correções:
endurecimento completo de RLS/grants, rate limiting distribuído e
idempotência/transações atômicas em todos os fluxos financeiros e de estoque.

Mais detalhes:

- `_docs/QUICK_REFERENCE.md`
- `_docs/PROJECT_STATUS.md`
- `_docs/SECURITY.md`
- `_docs/OPERATIONS.md`
