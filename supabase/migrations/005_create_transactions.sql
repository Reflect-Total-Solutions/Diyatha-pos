-- 005_create_transactions.sql

do $$
begin
  if not exists (select 1 from pg_type where typname = 'price_type') then
    create type public.price_type as enum ('local', 'foreign');
  end if;

  if not exists (select 1 from pg_type where typname = 'print_status') then
    create type public.print_status as enum ('pending', 'printed', 'failed');
  end if;
end
$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_group_id uuid not null references public.transaction_groups(id) on delete cascade,
  cashier_id uuid not null references public.users(id),
  activity_id uuid not null references public.activities(id),
  price_type public.price_type not null,
  amount numeric(10, 2) not null,
  token_index integer,
  token_total integer,
  txn_reference text not null unique,
  print_status public.print_status not null default 'pending',
  printed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_transaction_amount_non_negative check (amount >= 0),
  constraint chk_transaction_token_index_positive check (token_index is null or token_index > 0),
  constraint chk_transaction_token_total_positive check (token_total is null or token_total > 0),
  constraint chk_transaction_token_pair check (
    (token_index is null and token_total is null)
    or (token_index is not null and token_total is not null and token_total >= token_index)
  )
);

create index if not exists idx_transactions_group_id
  on public.transactions(transaction_group_id);

create index if not exists idx_transactions_cashier_id
  on public.transactions(cashier_id);

create index if not exists idx_transactions_activity_id
  on public.transactions(activity_id);

create index if not exists idx_transactions_created_at_desc
  on public.transactions(created_at desc);

create index if not exists idx_transactions_txn_reference
  on public.transactions(txn_reference);

drop trigger if exists trg_transactions_set_updated_at on public.transactions;
create trigger trg_transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();
