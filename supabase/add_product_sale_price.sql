-- Preço de venda override por produto (ex.: Somma Bear).
-- Quando preenchido e > 0, prevalece sobre `price` para exibição e cobrança ao cliente.
-- Aditivo e seguro: nullable, sem default, sem backfill.
alter table mafood.products
  add column if not exists sale_price numeric(10,2);

comment on column mafood.products.sale_price is
  'Preço de venda override. Se preenchido (>0), é o preço mostrado e cobrado ao cliente; senão usa price.';
