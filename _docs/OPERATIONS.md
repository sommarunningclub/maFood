# Operação e deploy

## Ambiente local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Use uma cópia de `.env.local` por ambiente. Não versione esse arquivo.

## Banco

A aplicação usa o schema `mafood`, não o `public`, para os dados operacionais.

Para o baseline histórico:

1. Execute `supabase/setup_mafood_schema.sql` no SQL Editor.
2. Execute as evoluções `0005` a `0014` de `supabase/migrations/`, em ordem.
3. Confirme tabelas, colunas e índices antes de iniciar a aplicação.

As migrations `0001`, `0003` e `0004` documentam a evolução anterior e não
devem ser reaplicadas sobre o baseline dedicado sem revisão. O baseline já
incorpora os recursos de `0003` e `0004`.

Antes de produção, aplique o endurecimento descrito em `_docs/SECURITY.md`.

## Supabase Storage

O bucket esperado é `pdv-assets`. Uploads válidos são gravados em:

```text
pdvs/<pdv-id>/<logo|product|combo>/<uuid>.webp
```

O servidor sempre gera o caminho. Não conceda escrita anônima no bucket.

## Asaas

Sandbox:

```env
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_ALLOW_SIMULATED=false
```

Produção:

```env
ASAAS_BASE_URL=https://api.asaas.com/v3
ASAAS_ALLOW_SIMULATED=false
```

Configure o webhook para:

```text
POST /api/webhooks/asaas
```

O token enviado pelo Asaas deve ser igual a `ASAAS_WEBHOOK_TOKEN`.

## E-mail

O envio de link de pagamento requer:

```env
RESEND_API_KEY=re_...
VIP_EMAIL_FROM="maFood <pagamentos@dominio.com>"
NEXT_PUBLIC_APP_URL=https://app.dominio.com
```

`NEXT_PUBLIC_APP_URL` evita que links sejam montados a partir de headers
fornecidos pelo cliente.

## Verificação de release

```bash
pnpm test
pnpm lint
pnpm build
```

Faça o build sem um processo `next dev` usando o mesmo diretório. Os dois
processos compartilham `.next` e podem produzir erros falsos de página ausente.

## Diagnóstico

Erros internos retornam uma resposta semelhante a:

```json
{
  "error": "Não foi possível concluir a operação",
  "request_id": "..."
}
```

Pesquise o `request_id` nos logs da aplicação. Não exponha a mensagem original
do banco ou do provedor na resposta pública.

Para falhas de pagamento:

1. confirme `ASAAS_BASE_URL` e `ASAAS_API_KEY`;
2. verifique o token do webhook;
3. localize o pedido pelo UUID e o evento em `webhook_logs`;
4. confirme que simulação não está ativa em produção.

Para falhas de upload:

1. confirme tamanho máximo de 5 MB;
2. use JPEG, PNG ou WebP real, não apenas uma extensão renomeada;
3. confira o bucket `pdv-assets`;
4. localize o `request_id` nos logs.

## Rollback

- Prefira reverter o deploy da aplicação antes de alterar dados.
- Migrations devem ter um plano de rollback revisado manualmente.
- Não use comandos destrutivos no banco sem backup e janela de manutenção.
- Mudanças de pagamento e estoque exigem validação de consistência após rollback.
