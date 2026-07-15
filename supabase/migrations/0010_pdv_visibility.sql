-- Visibilidade do PDV no cardápio/marketplace do cliente.
-- Independente de is_open (aberto/fechado p/ pedidos): is_visible controla se
-- o PDV aparece na lista do marketplace e se o link direto é acessível.
alter table mafood.pdvs
  add column if not exists is_visible boolean not null default true;

comment on column mafood.pdvs.is_visible is
  'Se false, o PDV some do marketplace e o link direto fica inacessível. Independente de is_open.';
