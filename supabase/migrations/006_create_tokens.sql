-- 006_create_tokens.sql

create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  token_number text not null unique,
  token_index integer not null default 1,
  token_total integer not null default 1,
  printed_at timestamptz not null default now(),
  reprint_count integer not null default 0,
  first_reprinted_at timestamptz,
  latest_reprinted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_tokens_index_positive check (token_index > 0),
  constraint chk_tokens_total_positive check (token_total > 0),
  constraint chk_tokens_total_at_least_index check (token_total >= token_index),
  constraint chk_tokens_reprint_count_non_negative check (reprint_count >= 0)
);

create index if not exists idx_tokens_transaction_id
  on public.tokens(transaction_id);

create index if not exists idx_tokens_token_number
  on public.tokens(token_number);
