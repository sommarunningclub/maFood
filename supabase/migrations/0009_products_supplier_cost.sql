-- Custo de fornecedor por produto, pra cálculo automático de margem.
-- NULL = sem custo informado (não calcula margem).

alter table mafood.products
  add column if not exists supplier_cost numeric(10,2);

comment on column mafood.products.supplier_cost is
  'Custo de aquisição/fornecedor por unidade. NULL = não informado.';
