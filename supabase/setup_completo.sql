-- ════════════════════════════════════════════════════════════════════
-- maFood — setup completo (schema + RLS + seed)
-- Idempotente: pode rodar o arquivo INTEIRO quantas vezes quiser.
-- Rode no SQL Editor do projeto de destino (sommarunning_2026), tudo de uma vez.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums (idempotente) ──────────────────────────────────────────────
do $$ begin
  create type order_status as enum ('pending','paid','preparing','ready','delivered','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_method as enum ('pix','card');
exception when duplicate_object then null; end $$;
do $$ begin
  create type product_status as enum ('active','paused','out_of_stock');
exception when duplicate_object then null; end $$;
do $$ begin
  create type coupon_type as enum ('percent','fixed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app_role as enum ('superadmin','venue_admin','pdv_operator');
exception when duplicate_object then null; end $$;

-- ── Tabelas ──────────────────────────────────────────────────────────
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text default '',
  logo_url text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists pdvs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  unique (venue_id, slug)
);

create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references pdvs(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references pdvs(id) on delete cascade,
  category text default '',
  name text not null,
  description text default '',
  image_url text default '',
  price numeric(10,2) not null,
  status product_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text, cpf text, phone text,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade,
  code text not null,
  type coupon_type not null,
  value numeric(10,2) not null,
  min_order numeric(10,2) not null default 0,
  max_uses int not null default 0,
  used int not null default 0,
  is_active boolean not null default true,
  valid_until date,
  unique (venue_id, code)
);

create sequence if not exists order_number_seq start 1042;
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number int not null default nextval('order_number_seq'),
  venue_id uuid not null references venues(id) on delete cascade,
  pdv_id uuid not null references pdvs(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  customer_cpf text,
  total numeric(10,2) not null,
  method payment_method not null,
  status order_status not null default 'pending',
  notes text,
  coupon_id uuid references coupons(id) on delete set null,
  asaas_payment_id text,
  pix_qr_code text,
  pix_payload text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  ready_at timestamptz
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null,
  notes text
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references pdvs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  gateway_fee numeric(12,2) not null default 0,
  net numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'asaas',
  event_id text unique,
  event_type text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  venue_id uuid references venues(id) on delete cascade,
  pdv_id uuid references pdvs(id) on delete cascade,
  unique (user_id, role, venue_id, pdv_id)
);

-- ── Índices ──────────────────────────────────────────────────────────
create index if not exists idx_pdvs_venue on pdvs(venue_id);
create index if not exists idx_products_pdv on products(pdv_id);
create index if not exists idx_orders_pdv_status on orders(pdv_id, status);
create index if not exists idx_orders_venue on orders(venue_id);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_webhook_event on webhook_logs(event_id);
create index if not exists idx_user_roles_user on user_roles(user_id);

-- ── Realtime (ignora se já estiver na publicação) ────────────────────
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table order_items;
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
create or replace function has_role(p_role app_role)
returns boolean language sql stable security definer as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function owns_pdv(p_pdv uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and (role = 'superadmin'
        or (role = 'pdv_operator' and pdv_id = p_pdv)
        or (role = 'venue_admin' and venue_id = (select venue_id from pdvs where id = p_pdv)))
  );
$$;

alter table venues enable row level security;
alter table pdvs enable row level security;
alter table products enable row level security;
alter table product_categories enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table coupons enable row level security;
alter table payouts enable row level security;
alter table webhook_logs enable row level security;
alter table user_roles enable row level security;

-- drop+create p/ idempotência das policies
drop policy if exists "venues readable" on venues;
create policy "venues readable" on venues for select using (is_active or has_role('superadmin'));
drop policy if exists "admin manage venues" on venues;
create policy "admin manage venues" on venues for all using (has_role('superadmin')) with check (has_role('superadmin'));

drop policy if exists "pdvs readable" on pdvs;
create policy "pdvs readable" on pdvs for select using (true);
drop policy if exists "admin manage pdvs" on pdvs;
create policy "admin manage pdvs" on pdvs for all using (has_role('superadmin') or has_role('venue_admin')) with check (has_role('superadmin') or has_role('venue_admin'));

drop policy if exists "products readable" on products;
create policy "products readable" on products for select using (true);
drop policy if exists "pdv manage products" on products;
create policy "pdv manage products" on products for all using (owns_pdv(pdv_id)) with check (owns_pdv(pdv_id));

drop policy if exists "categories readable" on product_categories;
create policy "categories readable" on product_categories for select using (true);
drop policy if exists "pdv manage categories" on product_categories;
create policy "pdv manage categories" on product_categories for all using (owns_pdv(pdv_id)) with check (owns_pdv(pdv_id));

drop policy if exists "anyone create customer" on customers;
create policy "anyone create customer" on customers for insert with check (true);

drop policy if exists "coupons readable" on coupons;
create policy "coupons readable" on coupons for select using (is_active);
drop policy if exists "admin manage coupons" on coupons;
create policy "admin manage coupons" on coupons for all using (has_role('superadmin') or has_role('venue_admin')) with check (has_role('superadmin') or has_role('venue_admin'));

drop policy if exists "anyone create order" on orders;
create policy "anyone create order" on orders for insert with check (true);
drop policy if exists "anyone read own order" on orders;
create policy "anyone read own order" on orders for select using (true);
drop policy if exists "pdv update orders" on orders;
create policy "pdv update orders" on orders for update using (owns_pdv(pdv_id));

drop policy if exists "anyone create items" on order_items;
create policy "anyone create items" on order_items for insert with check (true);
drop policy if exists "anyone read items" on order_items;
create policy "anyone read items" on order_items for select using (true);

drop policy if exists "admin read payouts" on payouts;
create policy "admin read payouts" on payouts for select using (has_role('superadmin') or owns_pdv(pdv_id));

drop policy if exists "read own roles" on user_roles;
create policy "read own roles" on user_roles for select using (user_id = auth.uid() or has_role('superadmin'));
drop policy if exists "admin manage roles" on user_roles;
create policy "admin manage roles" on user_roles for all using (has_role('superadmin')) with check (has_role('superadmin'));
-- webhook_logs: sem policy = só service_role acessa (proposital)

-- ════════════════════════════════════════════════════════════════════
-- SEED (Somma Special Day) — idempotente via slugs/codes
-- ════════════════════════════════════════════════════════════════════
insert into venues (slug, name, description)
values ('somma-special-day', 'Somma Special Day', '1 ano de Somma Club · COPMDF, Brasília · 18 jul 2026')
on conflict (slug) do nothing;

with v as (select id from venues where slug='somma-special-day')
insert into pdvs (venue_id, slug, name, category, logo_url, prep_time_min, commission_pct, gateway_pct, is_open, sort_order, wallet_balance)
select v.id, x.slug, x.name, x.category, x.logo, x.prep, x.comm, 3.6, x.open, x.ord, x.bal
from v, (values
  ('smash-house','Smash House','Hambúrgueres','🍔',12,15,true,1,3712.40),
  ('beer-club','Beer Club','Bebidas','🍺',4,12,true,2,2308.00),
  ('acai-power','Açaí Power','Saudável','🥣',8,15,true,3,1490.50),
  ('coffee-lab','Coffee Lab','Café','☕',6,15,false,4,498.00),
  ('somma-store','Somma Store','Loja','🎽',2,10,true,5,247.90)
) as x(slug,name,category,logo,prep,comm,open,ord,bal)
on conflict (venue_id, slug) do nothing;

-- Produtos (idempotente: só insere se o PDV ainda não tem produtos)
insert into products (pdv_id, category, name, description, price, status)
select p.id, x.cat, x.name, x.descr, x.price, x.status::product_status
from pdvs p
join venues v on v.id = p.venue_id and v.slug='somma-special-day'
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
where not exists (select 1 from products pp where pp.pdv_id = p.id);

with v as (select id from venues where slug='somma-special-day')
insert into coupons (venue_id, code, type, value, min_order, max_uses, used, is_active, valid_until)
select v.id, x.code, x.type::coupon_type, x.val, x.min, x.max, x.used, x.active, x.until::date
from v, (values
  ('SOMMA1ANO','percent',10,30,200,47,true,'2026-07-18'),
  ('PRIMEIRACOMPRA','fixed',5,20,400,132,true,'2026-07-18'),
  ('RUNNERS','percent',15,50,100,100,false,'2026-07-18')
) as x(code,type,val,min,max,used,active,until)
on conflict (venue_id, code) do nothing;
