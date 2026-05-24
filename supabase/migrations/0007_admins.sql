-- 0007: admins do backoffice maFood.
-- Login com email + senha (bcrypt). JWT cookie de 12h.
-- Bootstrap do primeiro admin via POST /api/admin/setup (só funciona com tabela vazia).

create table if not exists mafood.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists admins_email_idx on mafood.admins(lower(email));

comment on table mafood.admins is
  'Administradores do backoffice. Senha bcrypt; sessão via JWT cookie (mafood_admin).';
