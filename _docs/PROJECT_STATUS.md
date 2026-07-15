# maFood — status do projeto

Atualizado em 15 de julho de 2026.

## Implementado

Cliente:

- marketplace e cardápio por evento/PDV;
- cadastro e sessão por CPF;
- carrinho persistido, versionado e reconciliado com o catálogo;
- checkout com Pix, cartão, pagamento no balcão e cupons;
- histórico, cancelamento e acompanhamento autenticado;
- PWA com manifest e service worker.

PDV:

- login por slug e PIN;
- atualização periódica de pedidos e pedido manual;
- mudança de status e retirada parcial;
- cardápio, categorias, estoque, combos e perfil;
- envio de link de pagamento por e-mail ou WhatsApp.

Admin:

- login, setup inicial e sessão própria;
- dashboard com KPIs e gráficos vindos do Supabase;
- pedidos, PDVs e produtos;
- cupons reais com ativação persistida;
- financeiro calculado a partir de pedidos e payouts reais.

Plataforma:

- Supabase no schema `mafood`;
- Asaas Pix/cartão/webhook, com simulação apenas por opt-in;
- uploads processados com `sharp`;
- mensagens de erro públicas genéricas e correlação por `request_id`;
- testes unitários de pricing, Pix, PDV e upload.

## Correções concluídas neste ciclo

16. Upload seguro
   - validação por assinatura, limite, decode, resize e reencode WebP;
   - escopo do caminho validado no servidor;
   - SVG e conteúdo incompatível rejeitados.

17. Privacidade e erros
   - erros de banco/provedor não são mais devolvidos diretamente;
   - tracking e estados de pagamento do cliente usam API com ownership;
   - CPF do cliente é mascarado na superfície PDV.

18. Checkout
   - reconciliação do carrinho antes do envio;
   - preços e cupons validados no servidor;
   - estado pendente explícito para análise de cartão;
   - mensagens de falha e retomada corrigidas.

19. Cardápio
   - conteúdo visível mesmo sem animação JavaScript;
   - carrinho reconciliado após hidratação;
   - transições não deixam a página permanentemente transparente.

21. Dados mock
   - dashboard, financeiro e cupons migrados para Supabase;
   - `src/lib/mock-data.ts` removido.

23. Carrinho e performance
   - persistência mínima e versionada;
   - migração de estado antigo;
   - provider e dependência React Query não utilizados removidos;
   - fontes administrativas carregadas apenas nos layouts necessários.

26. Documentação
   - README, `.env.example`, referência rápida, segurança e operação atualizados.

## Pendências conhecidas

Segurança:

- fechar RLS, grants e default privileges permissivos do baseline histórico;
- adicionar rate limiting compartilhado;
- fortalecer autenticação do cliente além do CPF;
- tornar fluxos de estoque/cupom/pedido integralmente atômicos e idempotentes.

Operação:

- validar o fluxo completo com credenciais sandbox Asaas;
- executar ensaio de webhook e recuperação de falhas;
- configurar observabilidade externa e alertas;
- formalizar migrations de produção e rollback.

Qualidade:

- ampliar testes de integração dos Route Handlers;
- adicionar testes E2E do checkout;
- testar concorrência de estoque e limite de cupons.

Consulte `_docs/SECURITY.md` antes de qualquer liberação pública.
