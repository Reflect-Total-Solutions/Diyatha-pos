-- 004_create_transaction_groups.sql

create table if not exists public.transaction_groups (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint chk_group_completion_after_start
    check (completed_at is null or completed_at >= started_at)
);

create index if not exists idx_transaction_groups_cashier_id
  on public.transaction_groups(cashier_id);

create index if not exists idx_transaction_groups_started_at_desc
  on public.transaction_groups(started_at desc);
