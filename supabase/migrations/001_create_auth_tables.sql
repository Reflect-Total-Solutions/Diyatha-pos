-- 001_create_auth_tables.sql
-- Foundation tables and shared trigger helpers.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('cashier', 'admin');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.user_role not null default 'cashier',
  display_name text not null,
  phone text,
  is_active boolean not null default true,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role_active
  on public.users(role, is_active);

create index if not exists idx_users_email
  on public.users(email);

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();
