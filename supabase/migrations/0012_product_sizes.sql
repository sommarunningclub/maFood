-- Tamanhos/variantes de produto (ex.: smoothie 360 ml / 480 ml)
alter table mafood.products
  add column if not exists sizes jsonb;

comment on column mafood.products.sizes is
  'Opções de tamanho [{label, price, note?}]. Quando presente, price do produto é o menor tamanho.';
