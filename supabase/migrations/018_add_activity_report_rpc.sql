-- 018_add_activity_report_rpc.sql
--
-- Aggregates daily_summary into one row per activity so the result set is
-- tiny (≤ number of activities) and never hits PostgREST's max-rows cap.
-- SECURITY DEFINER runs as the function owner, bypassing RLS — the caller
-- is responsible for passing the correct p_vendor_id filter for vendors.

create or replace function public.get_activity_report_data(
  p_from        date    default null,
  p_to          date    default null,
  p_vendor_id   uuid    default null,
  p_activity_id uuid    default null,
  p_cashier_id  uuid    default null
)
returns table (
  activity_id    uuid,
  activity_name  text,
  local_count    bigint,
  foreign_count  bigint,
  total_count    bigint,
  local_total    numeric,
  foreign_total  numeric,
  total_amount   numeric
)
language sql
security definer
set search_path = public
as $$
  select
    ds.activity_id,
    ds.activity_name,
    coalesce(sum(ds.count) filter (where ds.price_type = 'local'),   0) as local_count,
    coalesce(sum(ds.count) filter (where ds.price_type = 'foreign'), 0) as foreign_count,
    coalesce(sum(ds.count),                                           0) as total_count,
    coalesce(round(sum(ds.total_amount) filter (where ds.price_type = 'local')::numeric,   2), 0) as local_total,
    coalesce(round(sum(ds.total_amount) filter (where ds.price_type = 'foreign')::numeric, 2), 0) as foreign_total,
    coalesce(round(sum(ds.total_amount)::numeric,                                           2), 0) as total_amount
  from public.daily_summary ds
  where
    (p_from        is null or ds.sale_date    >= p_from)        and
    (p_to          is null or ds.sale_date    <= p_to)          and
    (p_vendor_id   is null or ds.vendor_id    = p_vendor_id)    and
    (p_activity_id is null or ds.activity_id  = p_activity_id)  and
    (p_cashier_id  is null or ds.cashier_id   = p_cashier_id)
  group by ds.activity_id, ds.activity_name
  order by total_amount desc;
$$;
