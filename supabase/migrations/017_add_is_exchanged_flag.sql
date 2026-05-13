-- 017_add_is_exchanged_flag.sql
--
-- Adds an explicit `is_exchanged` boolean to transactions so a ticket
-- involved in an exchange (either side) can never be exchanged again.
-- Re-running this migration is safe (IF NOT EXISTS).

alter table public.transactions
  add column if not exists is_exchanged boolean not null default false;

-- Backfill: any pre-existing rows that participated in an exchange are flagged.
update public.transactions
set is_exchanged = true
where (exchanged_to_transaction_id is not null
       or exchanged_from_transaction_id is not null)
  and is_exchanged = false;
