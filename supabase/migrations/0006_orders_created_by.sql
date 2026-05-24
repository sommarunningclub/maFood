-- 0006: distinguir pedidos criados pelo cliente (PWA) vs pelo PDV (POS manual).
-- Permite ao cliente ver "Aguardando pagamento" no histórico para pedidos
-- gerados pelo operador do PDV.

alter table mafood.orders
  add column if not exists created_by text not null default 'customer'
    check (created_by in ('customer', 'pdv'));

create index if not exists orders_created_by_status_idx
  on mafood.orders(customer_id, status, created_at desc);

comment on column mafood.orders.created_by is
  'origem: customer = pedido feito pelo cliente no PWA; pdv = registrado pelo operador, cobrança pendente';
