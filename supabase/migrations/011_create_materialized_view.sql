-- 011_create_materialized_view.sql

create materialized view if not exists public.daily_summary as
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

create unique index if not exists idx_daily_summary_unique
  on public.daily_summary(cashier_id, sale_date, activity_id, price_type);

create index if not exists idx_daily_summary_sale_date_desc
  on public.daily_summary(sale_date desc);

create index if not exists idx_daily_summary_activity_id
  on public.daily_summary(activity_id);
