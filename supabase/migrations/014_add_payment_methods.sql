-- 014_add_payment_methods.sql

-- Add payment_method enum and column to transaction_groups and transactions tables
-- Avoids dropping any tables

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method_type') then
    create type public.payment_method_type as enum ('cash', 'card');
  end if;
end
$$;

-- Add to transaction_groups
alter table public.transaction_groups
add column if not exists payment_method public.payment_method_type not null default 'cash';

-- Add to transactions
alter table public.transactions
add column if not exists payment_method public.payment_method_type not null default 'cash';

-- Recreate view to include the payment_method at the end to avoid column recreation errors
create or replace view public.daily_summary as
  select
    t.cashier_id,
    date(t.created_at at time zone 'Asia/Colombo') as sale_date,
    a.id as activity_id,
    a.name as activity_name,
    t.price_type,
    count(*) filter (where t.cancelled_at is null) as count,
    sum(t.amount) filter (where t.cancelled_at is null) as total_amount,
    t.payment_method
  from public.transactions t
  join public.activities a on a.id = t.activity_id
  where t.created_at >= now() - interval '2 years'
  group by
    t.cashier_id,
    date(t.created_at at time zone 'Asia/Colombo'),
    a.id,
    a.name,
    t.price_type,
    t.payment_method;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
