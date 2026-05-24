-- ════════════════════════════════════════════════════════════════════
-- maFood — setup completo em SCHEMA DEDICADO `mafood`
-- IDEMPOTENTE: rode o arquivo INTEIRO no SQL Editor do sommarunning_2026.
-- Isola maFood do schema public (que tem outro sistema em produção).
-- Lê lista_vip do public sem alterar.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create schema if not exists mafood;
grant usage on schema mafood to anon, authenticated, service_role;

-- Permissões nas tabelas/sequências existentes (executado DEPOIS dos CREATEs ao final)
-- + defaults para tabelas futuras
alter default privileges in schema mafood grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema mafood grant all on tables to service_role;
alter default privileges in schema mafood grant usage, select on sequences to anon, authenticated;
alter default privileges in schema mafood grant all on sequences to service_role;

set search_path = mafood, public;

-- ── Enums ────────────────────────────────────────────────────────────
do $$ begin
  create type mafood.order_status as enum ('pending','paid','preparing','ready','partial','delivered','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type mafood.payment_method as enum ('pix','card');
exception when duplicate_object then null; end $$;
do $$ begin create type mafood.product_status as enum ('active','paused','out_of_stock');
exception when duplicate_object then null; end $$;
do $$ begin create type mafood.coupon_type as enum ('percent','fixed');
exception when duplicate_object then null; end $$;
do $$ begin create type mafood.app_role as enum ('superadmin','venue_admin','pdv_operator');
exception when duplicate_object then null; end $$;
do $$ begin create type mafood.combo_type as enum ('fixed','choice','discount');
exception when duplicate_object then null; end $$;

-- ── Tabelas ──────────────────────────────────────────────────────────
create table if not exists mafood.venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text default '',
  logo_url text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists mafood.pdvs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references mafood.venues(id) on delete cascade,
  slug text not null,
  name text not null,
  category text default '',
  logo_url text default '',
  prep_time_min int not null default 10,
  commission_pct numeric(5,2) not null default 15,
  gateway_pct numeric(5,2) not null default 3.6,
  is_open boolean not null default true,
  sort_order int not null default 0,
  asaas_wallet_id text,
  wallet_balance numeric(12,2) not null default 0,
  instagram_handle text,
  email text,
  pin_hash text,
  pin_set_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, slug)
);

create table if not exists mafood.product_categories (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists mafood.products (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  category text default '',
  name text not null,
  description text default '',
  image_url text default '',
  price numeric(10,2) not null,
  status mafood.product_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists mafood.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text unique,
  email text,
  phone text,
  is_vip boolean not null default false,
  lista_vip_id uuid references public.lista_vip(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mafood.coupons (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references mafood.venues(id) on delete cascade,
  code text not null,
  type mafood.coupon_type not null,
  value numeric(10,2) not null,
  min_order numeric(10,2) not null default 0,
  max_uses int not null default 0,
  used int not null default 0,
  is_active boolean not null default true,
  valid_until date,
  unique (venue_id, code)
);

create table if not exists mafood.coupons_pdvs (
  coupon_id uuid not null references mafood.coupons(id) on delete cascade,
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  primary key (coupon_id, pdv_id)
);

create sequence if not exists mafood.order_number_seq start 1042;
create table if not exists mafood.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('mafood.order_number_seq'),
  venue_id uuid not null references mafood.venues(id) on delete cascade,
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  customer_id uuid references mafood.customers(id) on delete set null,
  customer_name text not null,
  customer_cpf text,
  total numeric(10,2) not null,
  method mafood.payment_method not null,
  status mafood.order_status not null default 'pending',
  notes text,
  coupon_id uuid references mafood.coupons(id) on delete set null,
  asaas_payment_id text,
  pix_qr_code text,
  pix_payload text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  ready_at timestamptz
);

create table if not exists mafood.combos (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  type mafood.combo_type not null default 'fixed',
  name text not null,
  description text default '',
  image_url text default '',
  price numeric(10,2),
  discount_pct numeric(5,2),
  discount_value numeric(10,2),
  status mafood.product_status not null default 'active',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists mafood.combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references mafood.combos(id) on delete cascade,
  product_id uuid not null references mafood.products(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  sort_order int not null default 0
);

create table if not exists mafood.combo_option_groups (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references mafood.combos(id) on delete cascade,
  name text not null,
  min_choices int not null default 1,
  max_choices int not null default 1,
  sort_order int not null default 0
);

create table if not exists mafood.combo_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references mafood.combo_option_groups(id) on delete cascade,
  product_id uuid not null references mafood.products(id) on delete cascade,
  extra_price numeric(10,2) not null default 0,
  sort_order int not null default 0
);

create table if not exists mafood.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references mafood.orders(id) on delete cascade,
  product_id uuid references mafood.products(id) on delete set null,
  combo_id uuid references mafood.combos(id) on delete set null,
  name text not null,
  qty int not null check (qty > 0),
  delivered_qty int not null default 0,
  unit_price numeric(10,2) not null,
  notes text,
  constraint order_items_delivered_lte_qty check (delivered_qty <= qty)
);

create table if not exists mafood.payouts (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references mafood.pdvs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  gateway_fee numeric(12,2) not null default 0,
  net numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists mafood.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  event_id text unique,
  event_type text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists mafood.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role mafood.app_role not null,
  venue_id uuid references mafood.venues(id) on delete cascade,
  pdv_id uuid references mafood.pdvs(id) on delete cascade,
  unique (user_id, role, venue_id, pdv_id)
);

-- ── Índices ──────────────────────────────────────────────────────────
create index if not exists idx_mafood_pdvs_venue on mafood.pdvs(venue_id);
create index if not exists idx_mafood_products_pdv on mafood.products(pdv_id);
create index if not exists idx_mafood_orders_pdv_status on mafood.orders(pdv_id, status);
create index if not exists idx_mafood_orders_venue on mafood.orders(venue_id);
create index if not exists idx_mafood_orders_cpf on mafood.orders(customer_cpf);
create index if not exists idx_mafood_orders_created on mafood.orders(created_at desc);
create index if not exists idx_mafood_order_items_order on mafood.order_items(order_id);
create index if not exists idx_mafood_combos_pdv on mafood.combos(pdv_id);
create index if not exists idx_mafood_combo_items_combo on mafood.combo_items(combo_id);
create index if not exists idx_mafood_combo_groups_combo on mafood.combo_option_groups(combo_id);
create index if not exists idx_mafood_combo_options_group on mafood.combo_options(group_id);
create index if not exists idx_mafood_customers_cpf on mafood.customers(cpf);
create index if not exists idx_mafood_coupons_pdvs_pdv on mafood.coupons_pdvs(pdv_id);
create index if not exists idx_mafood_webhook_event on mafood.webhook_logs(event_id);
create index if not exists idx_mafood_user_roles_user on mafood.user_roles(user_id);

-- ════════════════════════════════════════════════════════════════════
-- Funções de autorização
-- ════════════════════════════════════════════════════════════════════
create or replace function mafood.has_role(p_role mafood.app_role)
returns boolean language sql stable security definer set search_path = mafood, public as $$
  select exists (select 1 from mafood.user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function mafood.owns_pdv(p_pdv uuid)
returns boolean language sql stable security definer set search_path = mafood, public as $$
  select exists (
    select 1 from mafood.user_roles
    where user_id = auth.uid()
      and (role = 'superadmin'
        or (role = 'pdv_operator' and pdv_id = p_pdv)
        or (role = 'venue_admin' and venue_id = (select venue_id from mafood.pdvs where id = p_pdv)))
  );
$$;

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table mafood.venues enable row level security;
alter table mafood.pdvs enable row level security;
alter table mafood.products enable row level security;
alter table mafood.product_categories enable row level security;
alter table mafood.customers enable row level security;
alter table mafood.orders enable row level security;
alter table mafood.order_items enable row level security;
alter table mafood.coupons enable row level security;
alter table mafood.coupons_pdvs enable row level security;
alter table mafood.payouts enable row level security;
alter table mafood.webhook_logs enable row level security;
alter table mafood.user_roles enable row level security;
alter table mafood.combos enable row level security;
alter table mafood.combo_items enable row level security;
alter table mafood.combo_option_groups enable row level security;
alter table mafood.combo_options enable row level security;

-- Catálogo público
drop policy if exists "venues readable" on mafood.venues;
create policy "venues readable" on mafood.venues for select using (is_active or mafood.has_role('superadmin'));
drop policy if exists "admin manage venues" on mafood.venues;
create policy "admin manage venues" on mafood.venues for all using (mafood.has_role('superadmin')) with check (mafood.has_role('superadmin'));

drop policy if exists "pdvs readable" on mafood.pdvs;
create policy "pdvs readable" on mafood.pdvs for select using (true);
drop policy if exists "admin manage pdvs" on mafood.pdvs;
create policy "admin manage pdvs" on mafood.pdvs for all using (mafood.has_role('superadmin') or mafood.has_role('venue_admin')) with check (mafood.has_role('superadmin') or mafood.has_role('venue_admin'));

drop policy if exists "products readable" on mafood.products;
create policy "products readable" on mafood.products for select using (true);
drop policy if exists "pdv manage products" on mafood.products;
create policy "pdv manage products" on mafood.products for all using (mafood.owns_pdv(pdv_id)) with check (mafood.owns_pdv(pdv_id));

drop policy if exists "categories readable" on mafood.product_categories;
create policy "categories readable" on mafood.product_categories for select using (true);
drop policy if exists "pdv manage categories" on mafood.product_categories;
create policy "pdv manage categories" on mafood.product_categories for all using (mafood.owns_pdv(pdv_id)) with check (mafood.owns_pdv(pdv_id));

drop policy if exists "coupons readable" on mafood.coupons;
create policy "coupons readable" on mafood.coupons for select using (is_active);
drop policy if exists "admin manage coupons" on mafood.coupons;
create policy "admin manage coupons" on mafood.coupons for all using (mafood.has_role('superadmin') or mafood.has_role('venue_admin')) with check (mafood.has_role('superadmin') or mafood.has_role('venue_admin'));

drop policy if exists "coupons_pdvs readable" on mafood.coupons_pdvs;
create policy "coupons_pdvs readable" on mafood.coupons_pdvs for select using (true);
drop policy if exists "admin manage coupons_pdvs" on mafood.coupons_pdvs;
create policy "admin manage coupons_pdvs" on mafood.coupons_pdvs for all using (mafood.has_role('superadmin') or mafood.has_role('venue_admin')) with check (mafood.has_role('superadmin') or mafood.has_role('venue_admin'));

-- Cliente público (acesso amplo para MVP — endurecer depois com auth real)
drop policy if exists "anyone read customers" on mafood.customers;
create policy "anyone read customers" on mafood.customers for select using (true);
drop policy if exists "anyone create customer" on mafood.customers;
create policy "anyone create customer" on mafood.customers for insert with check (true);
drop policy if exists "anyone update customer" on mafood.customers;
create policy "anyone update customer" on mafood.customers for update using (true);

drop policy if exists "anyone create order" on mafood.orders;
create policy "anyone create order" on mafood.orders for insert with check (true);
drop policy if exists "anyone read orders" on mafood.orders;
create policy "anyone read orders" on mafood.orders for select using (true);
drop policy if exists "pdv update orders" on mafood.orders;
create policy "pdv update orders" on mafood.orders for update using (mafood.owns_pdv(pdv_id));

drop policy if exists "anyone create items" on mafood.order_items;
create policy "anyone create items" on mafood.order_items for insert with check (true);
drop policy if exists "anyone read items" on mafood.order_items;
create policy "anyone read items" on mafood.order_items for select using (true);
drop policy if exists "pdv update items" on mafood.order_items;
create policy "pdv update items" on mafood.order_items for update using (
  mafood.owns_pdv((select pdv_id from mafood.orders where id = order_id))
);

-- Combos: leitura pública, gestão pelo PDV dono
drop policy if exists "combos readable" on mafood.combos;
create policy "combos readable" on mafood.combos for select using (true);
drop policy if exists "pdv manage combos" on mafood.combos;
create policy "pdv manage combos" on mafood.combos for all using (mafood.owns_pdv(pdv_id)) with check (mafood.owns_pdv(pdv_id));

drop policy if exists "combo items readable" on mafood.combo_items;
create policy "combo items readable" on mafood.combo_items for select using (true);
drop policy if exists "pdv manage combo items" on mafood.combo_items;
create policy "pdv manage combo items" on mafood.combo_items for all
  using (mafood.owns_pdv((select pdv_id from mafood.combos where id = combo_id)))
  with check (mafood.owns_pdv((select pdv_id from mafood.combos where id = combo_id)));

drop policy if exists "combo groups readable" on mafood.combo_option_groups;
create policy "combo groups readable" on mafood.combo_option_groups for select using (true);
drop policy if exists "pdv manage combo groups" on mafood.combo_option_groups;
create policy "pdv manage combo groups" on mafood.combo_option_groups for all
  using (mafood.owns_pdv((select pdv_id from mafood.combos where id = combo_id)))
  with check (mafood.owns_pdv((select pdv_id from mafood.combos where id = combo_id)));

drop policy if exists "combo options readable" on mafood.combo_options;
create policy "combo options readable" on mafood.combo_options for select using (true);
drop policy if exists "pdv manage combo options" on mafood.combo_options;
create policy "pdv manage combo options" on mafood.combo_options for all
  using (mafood.owns_pdv((select c.pdv_id from mafood.combo_option_groups g join mafood.combos c on c.id = g.combo_id where g.id = group_id)))
  with check (mafood.owns_pdv((select c.pdv_id from mafood.combo_option_groups g join mafood.combos c on c.id = g.combo_id where g.id = group_id)));

drop policy if exists "admin read payouts" on mafood.payouts;
create policy "admin read payouts" on mafood.payouts for select using (mafood.has_role('superadmin') or mafood.owns_pdv(pdv_id));

drop policy if exists "read own roles" on mafood.user_roles;
create policy "read own roles" on mafood.user_roles for select using (user_id = auth.uid() or mafood.has_role('superadmin'));
drop policy if exists "admin manage roles" on mafood.user_roles;
create policy "admin manage roles" on mafood.user_roles for all using (mafood.has_role('superadmin')) with check (mafood.has_role('superadmin'));

-- ════════════════════════════════════════════════════════════════════
-- View pública sobre lista_vip (sem expor codigo_unico)
-- ════════════════════════════════════════════════════════════════════
drop view if exists mafood.lista_vip_publico;
create view mafood.lista_vip_publico
with (security_invoker = true) as
select id, nome, cpf, email, telefone
from public.lista_vip;

-- ════════════════════════════════════════════════════════════════════
-- Storage bucket "pdv-assets"
-- ════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('pdv-assets', 'pdv-assets', true)
on conflict (id) do nothing;

drop policy if exists "pdv-assets public read" on storage.objects;
create policy "pdv-assets public read" on storage.objects for select using (bucket_id = 'pdv-assets');

drop policy if exists "pdv-assets pdv write" on storage.objects;
create policy "pdv-assets pdv write" on storage.objects for insert
  with check (bucket_id = 'pdv-assets' and (storage.foldername(name))[1] = 'pdvs'
    and mafood.owns_pdv(((storage.foldername(name))[2])::uuid));
drop policy if exists "pdv-assets pdv update" on storage.objects;
create policy "pdv-assets pdv update" on storage.objects for update
  using (bucket_id = 'pdv-assets' and (storage.foldername(name))[1] = 'pdvs'
    and mafood.owns_pdv(((storage.foldername(name))[2])::uuid));
drop policy if exists "pdv-assets pdv delete" on storage.objects;
create policy "pdv-assets pdv delete" on storage.objects for delete
  using (bucket_id = 'pdv-assets' and (storage.foldername(name))[1] = 'pdvs'
    and mafood.owns_pdv(((storage.foldername(name))[2])::uuid));

-- ════════════════════════════════════════════════════════════════════
-- Realtime
-- ════════════════════════════════════════════════════════════════════
do $$ begin alter publication supabase_realtime add table mafood.orders;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table mafood.order_items;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table mafood.combos;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table mafood.combo_items;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table mafood.customers;
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════
-- Seed (Somma Special Day)
-- ════════════════════════════════════════════════════════════════════
insert into mafood.venues (slug, name, description)
values ('somma-special-day', 'Somma Special Day', '1 ano de Somma Club · COPMDF, Brasília · 18 jul 2026')
on conflict (slug) do nothing;

with v as (select id from mafood.venues where slug='somma-special-day')
insert into mafood.pdvs (venue_id, slug, name, category, logo_url, prep_time_min, commission_pct, gateway_pct, is_open, sort_order, wallet_balance, instagram_handle)
select v.id, x.slug, x.name, x.category, x.logo, x.prep, x.comm, 3.6, x.open, x.ord, x.bal, x.insta
from v, (values
  ('smash-house','Smash House','Hambúrgueres','🍔',12,15,true,1,3712.40,'smashhousebsb'),
  ('beer-club','Beer Club','Bebidas','🍺',4,12,true,2,2308.00,'beerclub.df'),
  ('acai-power','Açaí Power','Saudável','🥣',8,15,true,3,1490.50,'acaipowerbsb'),
  ('coffee-lab','Coffee Lab','Café','☕',6,15,false,4,498.00,'coffeelabbsb'),
  ('somma-store','Somma Store','Loja','🎽',2,10,true,5,247.90,'sommaclub')
) as x(slug,name,category,logo,prep,comm,open,ord,bal,insta)
on conflict (venue_id, slug) do nothing;

insert into mafood.products (pdv_id, category, name, description, price, status)
select p.id, x.cat, x.name, x.descr, x.price, x.status::mafood.product_status
from mafood.pdvs p
join mafood.venues v on v.id = p.venue_id and v.slug='somma-special-day'
join (values
  ('smash-house','Combos','Combo Smash','2 smash burgers + fritas + refri',38,'active'),
  ('smash-house','Burgers','Smash Duplo','2 carnes, cheddar, picles',28,'active'),
  ('smash-house','Burgers','Smash Bacon','Carne, bacon crocante, cheddar',26,'paused'),
  ('smash-house','Acompanhamentos','Fritas Rústicas','Porção generosa',14,'active'),
  ('beer-club','Cervejas','Chopp Pilsen 500ml','Gelado',16,'active'),
  ('beer-club','Cervejas','IPA Artesanal','Long neck 355ml',22,'active'),
  ('beer-club','Sem álcool','Refrigerante Lata','Coca, Guaraná, Sprite',8,'out_of_stock'),
  ('acai-power','Açaí','Açaí 500ml','Com 3 acompanhamentos',24,'active'),
  ('acai-power','Açaí','Açaí Fitness','Banana, granola, whey',28,'active'),
  ('coffee-lab','Café','Cappuccino','Espresso + leite vaporizado',12,'active'),
  ('coffee-lab','Café','Cold Brew','12h de extração',15,'active'),
  ('somma-store','Vestuário','Camiseta Special Day','Edição comemorativa 1 ano',79,'active'),
  ('somma-store','Acessórios','Garrafa Térmica Somma','750ml inox',89,'active')
) as x(pdv_slug,cat,name,descr,price,status) on x.pdv_slug = p.slug
where not exists (select 1 from mafood.products pp where pp.pdv_id = p.id);

with v as (select id from mafood.venues where slug='somma-special-day')
insert into mafood.coupons (venue_id, code, type, value, min_order, max_uses, used, is_active, valid_until)
select v.id, x.code, x.type::mafood.coupon_type, x.val, x.min, x.max, x.used, x.active, x.until::date
from v, (values
  ('SOMMA1ANO','percent',10,30,200,47,true,'2026-07-18'),
  ('PRIMEIRACOMPRA','fixed',5,20,400,132,true,'2026-07-18'),
  ('RUNNERS','percent',15,50,100,100,false,'2026-07-18')
) as x(code,type,val,min,max,used,active,until)
on conflict (venue_id, code) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- IMPORTANTE: exponha o schema na API
-- Dashboard → Settings → API → "Exposed schemas" → adicione "mafood"
-- (sem isso, o supabase-js não enxerga as tabelas)
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- Permissões EXPLÍCITAS nas tabelas criadas neste script
-- (defaults só valem para tabelas futuras; aqui aplicamos no que já existe)
-- ════════════════════════════════════════════════════════════════════
grant select, insert, update, delete on all tables in schema mafood to anon, authenticated;
grant usage, select on all sequences in schema mafood to anon, authenticated;
grant all on all tables in schema mafood to service_role;
grant all on all sequences in schema mafood to service_role;
grant all on all functions in schema mafood to service_role;
