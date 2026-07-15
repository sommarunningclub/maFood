# Visão do projeto

Este arquivo substitui a especificação inicial de maio de 2026, que descrevia
o maFood como ainda não implementado e citava dependências e rotas que não
existem mais.

O maFood atual possui três aplicações no mesmo Next.js:

- cliente mobile em `/<venue>`;
- operação do lojista em `/loja/<slug>`;
- backoffice em `/admin`.

O backend é composto por Route Handlers do Next.js, Supabase PostgreSQL no
schema `mafood`, Supabase Storage, Asaas e Resend. O carrinho usa Zustand; não
há TanStack Query na aplicação.

Documentação canônica:

- `README.md`: visão geral e setup.
- `_docs/QUICK_REFERENCE.md`: rotas e componentes principais.
- `_docs/PROJECT_STATUS.md`: recursos concluídos e pendências.
- `_docs/SECURITY.md`: controles e riscos.
- `_docs/OPERATIONS.md`: deploy e diagnóstico.
- `IMPLEMENTATION_PLAN.md`: próximos ciclos.
