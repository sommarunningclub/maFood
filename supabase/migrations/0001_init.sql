-- maFood — schema inicial
-- Praças de alimentação multi-vendedor (Somma Special Day)

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────
create type order_status as enum
  ('pending','paid','preparing','ready','delivered','cancelled');
create type payment_method as enum ('pix','card');
create type product_status as enum ('active','paused','out_of_stock');
create type coupon_type as enum ('percent','fixed');
create type app_role as enum ('superadmin','venue_admin','pdv_operator');

-- ── Venues ───────────────────────────────────────────────────────────
create table venues (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── PDVs (lojistas) ──────────────────────────────────────────────────
create table pdvs (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references venues(id) on delete cascade,
  slug           text not null,
  name           text not null,
  category       text,
  logo_url       text,
  prep_time_min  int not null default 10,
  commission_pct numeric(5,2) not null default 15,
  gateway_pct    numeric(5,2) not null default 3.6,
  is_open        boolean not null default true,
  sort_order     int not null default 0,
  asaas_wallet_id text,
  created_at     timestamptz not null default now(),
  unique (venue_id, slug)
);

-- ── Categorias de produto ────────────────────────────────────────────
create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  pdv_id     uuid not null references pdvs(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0
);

-- ── Produtos ─────────────────────────────────────────────────────────
create table products (
  id          uuid primary key default gen_random_uuid(),
  pdv_id      uuid not null references pdvs(id) on delete cascade,
  category    text,
  name        text not null,
  description text,
  image_url   text,
  price       numeric(10,2) not null,        -- único valor armazenado (final)
  status      product_status not null default 'active',
  created_at  timestamptz not null default now()
);

-- ── Customers ────────────────────────────────────────────────────────
create table customers (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  cpf        text,
  phone      text,
  created_at timestamptz not null default now()
);

-- ── Orders ───────────────────────────────────────────────────────────
create sequence order_number_seq start 1042;
create table orders (
  id            uuid primary key default gen_random_uuid(),
  number        int not null default nextval('order_number_seq'),
  venue_id      uuid not null references venues(id),
  pdv_id        uuid not null references pdvs(id),
  customer_id   uuid references customers(id),
  customer_name text,
  customer_cpf  text,
  total         numeric(10,2) not null,
  method        payment_method not null,
  status        order_status not null default 'pending',
  notes         text,
  coupon_id     uuid,
  asaas_payment_id text,
  pix_qr_code   text,
  pix_payload   text,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz,
  ready_at      timestamptz
);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  name       text not null,
  qty        int not null,
  unit_price numeric(10,2) not null,
  notes      text
);

-- ── Coupons ──────────────────────────────────────────────────────────
create table coupons (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references venues(id) on delete cascade,
  code        text not null,
  type        coupon_type not null,
  value       numeric(10,2) not null,
  min_order   numeric(10,2) not null default 0,
  max_uses    int not null default 0,
  used        int not null default 0,
  is_active   boolean not null default true,
  valid_until date,
  unique (venue_id, code)
);

-- ── Payouts (repasses) ───────────────────────────────────────────────
create table payouts (
  id          uuid primary key default gen_random_uuid(),
  pdv_id      uuid not null references pdvs(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  gross        numeric(12,2) not null default 0,
  commission   numeric(12,2) not null default 0,
  gateway_fee  numeric(12,2) not null default 0,
  net          numeric(12,2) not null default 0,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

-- ── Webhook logs (idempotência / auditoria) ──────────────────────────
create table webhook_logs (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null default 'asaas',
  event_id     text unique,
  event_type   text,
  payload      jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── User roles (RLS) ─────────────────────────────────────────────────
create table user_roles (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      app_role not null,
  venue_id  uuid references venues(id) on delete cascade,
  pdv_id    uuid references pdvs(id) on delete cascade,
  unique (user_id, role, venue_id, pdv_id)
);

-- ── Índices críticos ─────────────────────────────────────────────────
create index idx_pdvs_venue       on pdvs(venue_id);
create index idx_products_pdv     on products(pdv_id);
create index idx_orders_pdv       on orders(pdv_id);
create index idx_orders_venue     on orders(venue_id);
create index idx_orders_status    on orders(status);
create index idx_orders_created   on orders(created_at desc);
create index idx_order_items_order on order_items(order_id);
create index idx_user_roles_user  on user_roles(user_id);
