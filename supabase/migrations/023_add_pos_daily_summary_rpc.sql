-- 023_add_pos_daily_summary_rpc.sql
--
-- Live per-cashier daily summary for the POS dashboard "Daily Summary" /
-- "Gross Total" panel. Previously the dashboard fetched every transaction for
-- the day (limit 10000) and summed them in the browser; on a busy day that is
-- ~1,800 rows per cashier, which dominated the ~6s dashboard load.
--
-- This aggregates server-side (a few ms) and returns a single row. It reads the
-- base tables directly (NOT the daily_summary materialized view) so the numbers
-- are always current for today.
--
-- Counting rules match components/pos/DailySummary.tsx exactly:
--   * Active row      = cancelled_at IS NULL. Counted in tickets/local/foreign
--                       and all amount totals.
--   * Cancelled count = cancelled_at IS NOT NULL AND exchanged_to is NULL.
--                       (An exchanged-away original is represented by its
--                        replacement row, so it is not a "true" cancellation.)
--   * Cash/Card       = attributed to the ORIGINAL ticket's payment_method when
--                       the row is an exchange replacement (exchanged_from set),
--                       else the row's own payment_method. Anything not 'card'
--                       counts as cash (matches the client's else-branch).
--
-- Safe on prod: creates a function only. No table/data changes, no locks.

create or replace function public.get_pos_daily_summary(
  p_cashier_id uuid,
  p_from       timestamptz,
  p_to         timestamptz
)
returns table (
  total_count     bigint,
  local_count     bigint,
  foreign_count   bigint,
  cancelled_count bigint,
  local_amount    numeric,
  foreign_amount  numeric,
  cash_amount     numeric,
  card_amount     numeric,
  total_amount    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      t.cancelled_at,
      t.price_type,
      t.amount,
      t.exchanged_to_transaction_id,
      coalesce(orig.payment_method, t.payment_method) as effective_payment_method
    from public.transactions t
    left join public.transactions orig
      on orig.id = t.exchanged_from_transaction_id
    where t.cashier_id = p_cashier_id
      and t.created_at >= p_from
      and t.created_at <  p_to
  )
  select
    count(*) filter (where cancelled_at is null)                              as total_count,
    count(*) filter (where cancelled_at is null and price_type = 'local')     as local_count,
    count(*) filter (where cancelled_at is null and price_type = 'foreign')   as foreign_count,
    count(*) filter (where cancelled_at is not null
                       and exchanged_to_transaction_id is null)               as cancelled_count,
    coalesce(round(sum(amount) filter (where cancelled_at is null and price_type = 'local')::numeric, 2), 0)   as local_amount,
    coalesce(round(sum(amount) filter (where cancelled_at is null and price_type = 'foreign')::numeric, 2), 0) as foreign_amount,
    coalesce(round(sum(amount) filter (where cancelled_at is null
                       and effective_payment_method is distinct from 'card')::numeric, 2), 0)                  as cash_amount,
    coalesce(round(sum(amount) filter (where cancelled_at is null
                       and effective_payment_method = 'card')::numeric, 2), 0)                                 as card_amount,
    coalesce(round(sum(amount) filter (where cancelled_at is null)::numeric, 2), 0)                            as total_amount
  from scoped;
$$;

grant execute on function public.get_pos_daily_summary(uuid, timestamptz, timestamptz) to authenticated;
