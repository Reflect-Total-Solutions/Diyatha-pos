-- 019_add_cashier_report_rpc.sql
--
-- Returns aggregated cashier report data with activity breakdown.
-- Groups by cashier_id and activity_id, aggregating transaction counts and amounts.
-- Uses the same counting logic as the activity report for consistency.

create or replace function public.get_cashier_report_data(
  p_from        date    default null,
  p_to          date    default null,
  p_vendor_id   uuid    default null,
  p_cashier_id  uuid    default null,
  p_activity_id uuid    default null
)
returns table (
  cashier_id    uuid,
  cashier_name  text,
  activity_id   uuid,
  activity_name text,
  local_count   bigint,
  foreign_count bigint,
  total_count   bigint,
  local_total   numeric,
  foreign_total numeric,
  cash_total    numeric,
  card_total    numeric,
  total_amount  numeric
)
language sql
security definer
set search_path = public
as $$
  select
    ds.cashier_id,
    u.display_name as cashier_name,
    ds.activity_id,
    ds.activity_name,
    coalesce(sum(ds.count) filter (where ds.price_type = 'local'),   0) as local_count,
    coalesce(sum(ds.count) filter (where ds.price_type = 'foreign'), 0) as foreign_count,
    coalesce(sum(ds.count),                                           0) as total_count,
    coalesce(round(sum(ds.total_amount) filter (where ds.price_type = 'local')::numeric,   2), 0) as local_total,
    coalesce(round(sum(ds.total_amount) filter (where ds.price_type = 'foreign')::numeric, 2), 0) as foreign_total,
    coalesce(round(sum(ds.total_amount) filter (where (ds).payment_method = 'cash')::numeric,   2), 0) as cash_total,
    coalesce(round(sum(ds.total_amount) filter (where (ds).payment_method = 'card')::numeric,   2), 0) as card_total,
    coalesce(round(sum(ds.total_amount)::numeric,                                           2), 0) as total_amount
  from public.daily_summary ds
  left join public.users u on u.id = ds.cashier_id
  where
    (p_from        is null or ds.sale_date    >= p_from)        and
    (p_to          is null or ds.sale_date    <= p_to)          and
    (p_vendor_id   is null or ds.vendor_id    = p_vendor_id)    and
    (p_cashier_id  is null or ds.cashier_id   = p_cashier_id)   and
    (p_activity_id is null or ds.activity_id  = p_activity_id)  and
    ds.cashier_id is not null
  group by ds.cashier_id, u.display_name, ds.activity_id, ds.activity_name
  order by ds.cashier_id, total_amount desc;
$$;
