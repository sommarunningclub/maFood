-- Adiciona controle de estoque opcional aos produtos.
-- stock_quantity: null = ilimitado (sem controle); >=0 = quantidade disponível.

alter table mafood.products
  add column if not exists stock_quantity int;

comment on column mafood.products.stock_quantity is
  'Quantidade em estoque. NULL = sem controle de estoque (ilimitado).';
