-- maFood — normaliza categorias de produto (schema mafood)
-- IDEMPOTENTE: rode inteiro no SQL Editor.

set search_path = mafood, public;

-- 1) products ganha category_id (opcional; pode ser null durante migração)
alter table mafood.products
  add column if not exists category_id uuid references mafood.product_categories(id) on delete set null;

create index if not exists idx_mafood_products_category on mafood.products(category_id);

-- 2) product_categories ganha "is_active" (PDV pode ocultar sem excluir)
alter table mafood.product_categories
  add column if not exists is_active boolean not null default true;

-- 3) Backfill: cria categorias a partir do products.category (text) por PDV
insert into mafood.product_categories (pdv_id, name, sort_order)
select p.pdv_id, p.category, row_number() over (partition by p.pdv_id order by min(p.created_at)) - 1
from mafood.products p
where p.category is not null
  and p.category <> ''
  and not exists (
    select 1 from mafood.product_categories c
    where c.pdv_id = p.pdv_id and c.name = p.category
  )
group by p.pdv_id, p.category
on conflict do nothing;

-- 4) Atualiza products.category_id baseado no nome existente
update mafood.products p
set category_id = c.id
from mafood.product_categories c
where p.pdv_id = c.pdv_id
  and p.category = c.name
  and p.category_id is null;

-- 5) RLS na product_categories já existe via setup_mafood_schema (herda do PDV)
-- Adicionamos policy de leitura pública (cliente vê categorias)
drop policy if exists "categories readable" on mafood.product_categories;
create policy "categories readable" on mafood.product_categories for select using (true);

-- 6) Realtime para categorias (admin/PDV vê mudanças ao vivo)
do $$ begin alter publication supabase_realtime add table mafood.product_categories;
exception when duplicate_object then null; end $$;
