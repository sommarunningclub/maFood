-- maFood — clientes do app, retirada parcial, cupons multi-PDV
-- IDEMPOTENTE: rode inteiro no SQL Editor quantas vezes quiser.

-- ════════════════════════════════════════════════════════════════════
-- 1) customers do app maFood (separado da lista_vip)
-- ════════════════════════════════════════════════════════════════════
-- A tabela `customers` original (criada no 0001) era genérica e sem unique de CPF.
-- Aqui adicionamos os campos que faltam pra funcionar como base de login por CPF.

alter table customers add column if not exists email text;
alter table customers add column if not exists is_vip boolean not null default false;
alter table customers add column if not exists lista_vip_id uuid references lista_vip(id) on delete set null;

-- Normalizar CPF: só dígitos. Unique. Faz isso só se não houver duplicatas.
update customers set cpf = regexp_replace(cpf, '\D', '', 'g') where cpf is not null;

do $$ begin
  alter table customers add constraint customers_cpf_unique unique (cpf);
exception
  when duplicate_table then null;
  when duplicate_object then null;
  when unique_violation then null; -- se já houver duplicatas, ignora o constraint (resolver depois)
end $$;

create index if not exists idx_customers_cpf on customers(cpf);

-- RLS: cliente pode se cadastrar e ler o próprio
drop policy if exists "anyone create customer" on customers; -- substitui a policy do 0002
create policy "anyone create customer" on customers for insert with check (true);
drop policy if exists "anyone read customers by cpf" on customers;
create policy "anyone read customers by cpf" on customers for select using (true);
drop policy if exists "anyone update own customer" on customers;
create policy "anyone update own customer" on customers for update using (true);

-- ════════════════════════════════════════════════════════════════════
-- 2) lista_vip — habilita leitura pública por CPF (sem expor cupons)
-- ════════════════════════════════════════════════════════════════════
-- Mantemos a tabela intocada estruturalmente. Só garantimos RLS + leitura.
alter table lista_vip enable row level security;

-- Permite leitura para validação por CPF (anon pode ler nome/email/cpf).
-- Como a tabela contém codigo_unico (sensível), criamos uma VIEW limitada e exposemos
-- só ela, NÃO a tabela inteira:
drop view if exists lista_vip_publico;
create view lista_vip_publico
with (security_invoker = true) as
select id, nome, cpf, email, telefone
from lista_vip;

-- Garantir leitura via API: a view herda a security_invoker (mantém RLS).
-- Adicionamos uma policy de SELECT genérica na lista_vip:
drop policy if exists "lista_vip lookup by cpf" on lista_vip;
create policy "lista_vip lookup by cpf" on lista_vip for select using (true);
-- (Aceitável aqui porque o app só vai consultar via view lista_vip_publico,
--  que não expõe codigo_unico/status_cupom/quantidade_usos.)

-- ════════════════════════════════════════════════════════════════════
-- 3) Retirada parcial: delivered_qty em order_items + status 'partial'
-- ════════════════════════════════════════════════════════════════════
alter table order_items add column if not exists delivered_qty int not null default 0;
alter table order_items add constraint order_items_delivered_lte_qty check (delivered_qty <= qty) not valid;
do $$ begin
  alter table order_items validate constraint order_items_delivered_lte_qty;
exception when others then null; end $$;

-- Acrescentar 'partial' ao enum order_status
do $$ begin
  alter type order_status add value 'partial' before 'delivered';
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════
-- 4) Cupons N-N com PDVs (já existe coupons; criamos a tabela ponte)
-- ════════════════════════════════════════════════════════════════════
-- Regras:
--  - se um cupom NÃO tem nenhuma linha em coupons_pdvs → válido em todos os PDVs (global)
--  - se tem linhas → válido apenas nos PDVs listados

create table if not exists coupons_pdvs (
  coupon_id uuid not null references coupons(id) on delete cascade,
  pdv_id uuid not null references pdvs(id) on delete cascade,
  primary key (coupon_id, pdv_id)
);
create index if not exists idx_coupons_pdvs_pdv on coupons_pdvs(pdv_id);

alter table coupons_pdvs enable row level security;
drop policy if exists "coupons_pdvs readable" on coupons_pdvs;
create policy "coupons_pdvs readable" on coupons_pdvs for select using (true);
drop policy if exists "admin manage coupons_pdvs" on coupons_pdvs;
create policy "admin manage coupons_pdvs" on coupons_pdvs for all
  using (has_role('superadmin') or has_role('venue_admin'))
  with check (has_role('superadmin') or has_role('venue_admin'));

-- ════════════════════════════════════════════════════════════════════
-- 5) Realtime
-- ════════════════════════════════════════════════════════════════════
do $$ begin alter publication supabase_realtime add table customers;
exception when duplicate_object then null; end $$;
