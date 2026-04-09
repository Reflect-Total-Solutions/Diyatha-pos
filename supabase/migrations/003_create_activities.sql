-- 003_create_activities.sql

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  local_price numeric(10, 2) not null default 500.00,
  foreign_price numeric(10, 2) not null default 750.00,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_activity_local_price_non_negative check (local_price >= 0),
  constraint chk_activity_foreign_price_non_negative check (foreign_price >= 0)
);

create index if not exists idx_activities_is_active
  on public.activities(is_active);

create index if not exists idx_activities_category_id
  on public.activities(category_id);

create index if not exists idx_activities_display_order
  on public.activities(display_order);

drop trigger if exists trg_activities_set_updated_at on public.activities;
create trigger trg_activities_set_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();
