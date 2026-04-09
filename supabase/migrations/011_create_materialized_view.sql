-- 011_create_materialized_view.sql

drop materialized view if exists public.daily_summary;

create or replace view public.daily_summary as
  select
    t.cashier_id,
    date(t.created_at at time zone 'Asia/Colombo') as sale_date,
    a.id as activity_id,
    a.name as activity_name,
    t.price_type,
    count(*) filter (where t.cancelled_at is null) as count,
    sum(t.amount) filter (where t.cancelled_at is null) as total_amount
  from public.transactions t
  join public.activities a on a.id = t.activity_id
  where t.created_at >= now() - interval '2 years'
  group by
    t.cashier_id,
    date(t.created_at at time zone 'Asia/Colombo'),
    a.id,
    a.name,
    t.price_type;

-- (Indexes not supported on regular views unless it's materialized, so we can ignore or recreate on the underlying tables if needed)
