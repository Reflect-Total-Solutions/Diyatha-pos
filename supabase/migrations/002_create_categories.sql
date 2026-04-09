-- 002_create_categories.sql

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_is_active
  on public.categories(is_active);

drop trigger if exists trg_categories_set_updated_at on public.categories;
create trigger trg_categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();
