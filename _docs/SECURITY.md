# Segurança

Este documento descreve os controles presentes e as pendências conhecidas. Ele
não substitui uma revisão antes de produção.

## Fronteiras de confiança

- A aplicação não instancia um cliente Supabase no navegador. Catálogo,
  pedidos e status passam por Server Components ou APIs próprias.
- `NEXT_PUBLIC_SUPABASE_URL` mantém o nome histórico, mas é usado pelo cliente
  Supabase server-side.
- `SUPABASE_SERVICE_ROLE_KEY`, `PDV_SESSION_SECRET`, chaves Asaas e Resend são
  segredos exclusivos do servidor.
- Route Handlers e Server Components podem usar `createAdminClient()`.
- Componentes client não podem importar `@/lib/supabase/admin`.

## Sessões

- Admin: e-mail e senha bcrypt; cookie JWT `httpOnly`.
- PDV: slug e PIN bcrypt; cookie JWT `httpOnly`.
- Cliente: identificação por CPF; cookie JWT `httpOnly`.
- Rotas de escrita validam novamente a sessão e o vínculo do recurso no
  servidor. Middleware não substitui autorização dentro do handler.

O fluxo atual de cliente usa conhecimento do CPF como fator de identificação.
Ele não deve ser tratado como autenticação forte para operações de alto risco.

## Pedidos e privacidade

- Status e detalhes de pedido do cliente são servidos por
  `/api/customer/orders/<id>`, com verificação de ownership.
- Pix, link de pagamento e acompanhamento usam polling autenticado em vez de
  consultas diretas às tabelas de pedidos no navegador.
- Respostas 5xx usam mensagens genéricas e um `request_id`; detalhes ficam
  somente no log do servidor.
- CPF exibido ao PDV deve permanecer mascarado.

## Uploads

Os endpoints `/api/admin/upload` e `/api/pdv/upload`:

- exigem uma sessão válida;
- limitam a entrada a 5 MB;
- aceitam somente bytes JPEG, PNG ou WebP válidos;
- comparam MIME declarado e assinatura do arquivo;
- rejeitam animações e imagens excessivamente grandes;
- redimensionam para no máximo 2400 × 2400;
- reencodam em WebP, removendo metadados e conteúdo ativo;
- geram o caminho no servidor e restringem o upload ao PDV autorizado.

SVG não é aceito.

## Pagamentos

- Simulação só pode ser habilitada explicitamente com
  `ASAAS_ALLOW_SIMULATED=true`.
- Produção deve usar `https://api.asaas.com/v3`; desenvolvimento deve usar
  sandbox.
- Webhooks devem validar `ASAAS_WEBHOOK_TOKEN`.
- Dados de cartão não devem ser logados nem persistidos.
- Erros do provedor não são devolvidos integralmente ao cliente.

## Pendências críticas conhecidas

Estas pendências não foram resolvidas pelo conjunto de correções 16, 17, 18,
19, 21, 23 e 26:

1. Revisar e fechar RLS, grants e default privileges do schema `mafood`.
2. Remover políticas históricas `USING (true)` e acesso CRUD do papel `anon`.
3. Confirmar que todo catálogo público continua servido apenas pelo servidor
   antes de fechar leituras anônimas.
4. Adicionar rate limiting compartilhado aos logins, lookup e pagamentos.
5. Tornar criação de pedido, cupom e estoque atômicos e idempotentes.
6. Fortalecer a autenticação do cliente além do CPF quando o risco exigir.
7. Rotacionar PINs e segredos após o endurecimento do banco.

O arquivo `supabase/setup_mafood_schema.sql` é um baseline histórico e contém
permissões de MVP. Não deve ser promovido como baseline seguro de produção.

## Checklist antes de produção

- [ ] `ASAAS_ALLOW_SIMULATED=false`.
- [ ] URLs e chaves apontam para o ambiente correto.
- [ ] `PDV_SESSION_SECRET` tem pelo menos 32 bytes aleatórios.
- [ ] Segredos existem apenas no ambiente server-side.
- [ ] Webhook Asaas configurado com HTTPS e token.
- [ ] Bucket `pdv-assets` não permite escrita anônima.
- [ ] RLS/grants validados com testes executados como `anon`.
- [ ] Logs não contêm CPF completo nem dados de cartão.
- [ ] `pnpm test`, `pnpm lint` e `pnpm build` passam.
