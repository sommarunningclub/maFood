# maFood — plano de implementação

Atualizado em 15 de julho de 2026. O produto base já está implementado; este
plano cobre os próximos ciclos.

## Concluído neste ciclo

- upload seguro com decode e reencode;
- respostas de erro privadas e correlacionadas;
- polling autenticado para dados de pedido do cliente;
- reconciliação do carrinho e correções de checkout/cardápio;
- dashboard, financeiro e cupons com dados reais;
- remoção de mocks e dependências não utilizadas;
- documentação técnica e operacional.

## Ciclo 1 — banco e autorização

1. Criar migration de hardening para grants, default privileges e RLS.
2. Criar views/RPCs mínimas para catálogo público.
3. Remover acesso anônimo a customers, orders, order_items e dados internos de
   PDV.
4. Testar políticas com os papéis `anon`, `authenticated` e `service_role`.
5. Rotacionar PINs e segredos depois da correção.

Critério de saída: nenhum dado pessoal, financeiro ou credencial é legível por
`anon`.

## Ciclo 2 — consistência financeira

1. Tornar pedido, itens, estoque e uso de cupom uma operação transacional.
2. Adicionar idempotência à criação de cobranças e ao webhook.
3. Formalizar a máquina de estados de pedidos.
4. Tratar reembolso/cancelamento e falhas parciais.

Critério de saída: reenvios e concorrência não duplicam cobrança, pedido,
desconto ou baixa de estoque.

## Ciclo 3 — proteção contra abuso

1. Rate limiting compartilhado em login, lookup, checkout e pagamento.
2. Fortalecer a autenticação do cliente além do conhecimento do CPF.
3. Adicionar expiração e tentativas máximas aos links de pagamento.
4. Registrar eventos de segurança sem armazenar dados sensíveis.

## Ciclo 4 — qualidade e observabilidade

1. Testes de integração dos Route Handlers.
2. E2E de Pix, cartão, balcão, cupom e carrinho desatualizado.
3. Testes de concorrência de estoque e cupom.
4. Monitoramento de erros, métricas, alertas e runbooks.
5. CI com testes, lint, build e auditoria de dependências.

## Ciclo 5 — release

1. Ensaio completo em sandbox Asaas.
2. Revisão de variáveis e domínios.
3. Backup e plano de rollback das migrations.
4. Teste de carga do PDV e webhook.
5. Liberação gradual e monitorada.

Consulte `_docs/SECURITY.md` e `_docs/OPERATIONS.md` antes do deploy.