-- maFood — PDV self-service: instagram, PIN, combos (3 tipos), storage
-- IDEMPOTENTE: pode rodar inteiro quantas vezes quiser no SQL Editor.

create extension if not exists "pgcrypto";

-- ── PDVs: instagram, email, pin ───────────────────────────────────────
alter table pdvs add column if not exists instagram_handle text;
alter table pdvs add column if not exists email text;
alter table pdvs add column if not exists pin_hash text;       -- bcrypt do PIN (nunca o PIN cru)
alter table pdvs add column if not exists pin_set_at timestamptz;

-- ── Combos ────────────────────────────────────────────────────────────
do $$ begin
  create type combo_type as enum (
    'fixed',     -- itens fixos, preço único
    'choice',    -- cliente escolhe X itens entre N opções por grupo
    'discount'   -- aplica desconto quando combinação de itens estiver no carrinho
  );
exception when duplicate_object then null; end $$;

create table if not exists combos (
  id uuid primary key default gen_random_uuid(),
  pdv_id uuid not null references pdvs(id) on delete cascade,
  type combo_type not null default 'fixed',
  name text not null,
  description text default '',
  image_url text default '',
  price numeric(10,2),               -- usado em fixed/choice; null em discount
  discount_pct numeric(5,2),         -- usado em discount
  discount_value numeric(10,2),      -- usado em discount (fixo, alternativa ao pct)
  status product_status not null default 'active',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Itens fixos do combo (usado por fixed e como "âncoras" do discount)
create table if not exists combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  sort_order int not null default 0
);

-- Grupos de escolha (usado por choice). Ex.: "Escolha 1 burger"
create table if not exists combo_option_groups (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references combos(id) on delete cascade,
  name text not null,                 -- "Escolha o burger"
  min_choices int not null default 1,
  max_choices int not null default 1,
  sort_order int not null default 0
);

-- Opções dentro de um grupo
create table if not exists combo_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references combo_option_groups(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  extra_price numeric(10,2) not null default 0,  -- acréscimo se escolher essa opção
  sort_order int not null default 0
);

-- order_items ganha referência opcional ao combo de origem
alter table order_items add column if not exists combo_id uuid references combos(id) on delete set null;

create index if not exists idx_combos_pdv on combos(pdv_id);
create index if not exists idx_combo_items_combo on combo_items(combo_id);
create index if not exists idx_combo_groups_combo on combo_option_groups(combo_id);
create index if not exists idx_combo_options_group on combo_options(group_id);

-- ── RLS dos combos (segue o padrão dos produtos) ──────────────────────
alter table combos enable row level security;
alter table combo_items enable row level security;
alter table combo_option_groups enable row level security;
alter table combo_options enable row level security;

drop policy if exists "combos readable" on combos;
create policy "combos readable" on combos for select using (true);
drop policy if exists "pdv manage combos" on combos;
create policy "pdv manage combos" on combos for all using (owns_pdv(pdv_id)) with check (owns_pdv(pdv_id));

drop policy if exists "combo items readable" on combo_items;
create policy "combo items readable" on combo_items for select using (true);
drop policy if exists "pdv manage combo items" on combo_items;
create policy "pdv manage combo items" on combo_items for all
  using (owns_pdv((select pdv_id from combos where id = combo_id)))
  with check (owns_pdv((select pdv_id from combos where id = combo_id)));

drop policy if exists "combo groups readable" on combo_option_groups;
create policy "combo groups readable" on combo_option_groups for select using (true);
drop policy if exists "pdv manage combo groups" on combo_option_groups;
create policy "pdv manage combo groups" on combo_option_groups for all
  using (owns_pdv((select pdv_id from combos where id = combo_id)))
  with check (owns_pdv((select pdv_id from combos where id = combo_id)));

drop policy if exists "combo options readable" on combo_options;
create policy "combo options readable" on combo_options for select using (true);
drop policy if exists "pdv manage combo options" on combo_options;
create policy "pdv manage combo options" on combo_options for all
  using (owns_pdv((select c.pdv_id from combo_option_groups g join combos c on c.id = g.combo_id where g.id = group_id)))
  with check (owns_pdv((select c.pdv_id from combo_option_groups g join combos c on c.id = g.combo_id where g.id = group_id)));

-- ── Storage bucket "pdv-assets" (logos, fotos de produto) ─────────────
insert into storage.buckets (id, name, public)
values ('pdv-assets', 'pdv-assets', true)
on conflict (id) do nothing;

-- Leitura pública; escrita só por quem opera o PDV (path: pdvs/<pdv_id>/...)
drop policy if exists "pdv-assets public read" on storage.objects;
create policy "pdv-assets public read" on storage.objects for select
  using (bucket_id = 'pdv-assets');

drop policy if exists "pdv-assets pdv write" on storage.objects;
create policy "pdv-assets pdv write" on storage.objects for insert
  with check (
    bucket_id = 'pdv-assets'
    and (storage.foldername(name))[1] = 'pdvs'
    and owns_pdv(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "pdv-assets pdv update" on storage.objects;
create policy "pdv-assets pdv update" on storage.objects for update
  using (
    bucket_id = 'pdv-assets'
    and (storage.foldername(name))[1] = 'pdvs'
    and owns_pdv(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "pdv-assets pdv delete" on storage.objects;
create policy "pdv-assets pdv delete" on storage.objects for delete
  using (
    bucket_id = 'pdv-assets'
    and (storage.foldername(name))[1] = 'pdvs'
    and owns_pdv(((storage.foldername(name))[2])::uuid)
  );

-- Realtime nas tabelas de combo (PDV vê alterações ao vivo no admin)
do $$ begin alter publication supabase_realtime add table combos;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table combo_items;
exception when duplicate_object then null; end $$;

-- ── Seed: alguns valores de exemplo nos PDVs existentes ───────────────
update pdvs set instagram_handle = 'smashhousebsb'  where slug = 'smash-house'    and instagram_handle is null;
update pdvs set instagram_handle = 'beerclub.df'    where slug = 'beer-club'      and instagram_handle is null;
update pdvs set instagram_handle = 'acaipowerbsb'   where slug = 'acai-power'     and instagram_handle is null;
update pdvs set instagram_handle = 'coffeelabbsb'   where slug = 'coffee-lab'     and instagram_handle is null;
update pdvs set instagram_handle = 'sommaclub'      where slug = 'somma-store'    and instagram_handle is null;
