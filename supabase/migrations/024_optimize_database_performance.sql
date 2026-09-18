-- 024_optimize_database_performance.sql
--
-- Performance optimizations for high-volume POS transactions & fast multi-day search:
-- 1. Enables pg_trgm for ultra-fast trigram substring search (ILIKE '%...%')
-- 2. GIN trigram indexes on txn_reference and token_number
-- 3. Composite and partial indexes for active tickets and date/cashier filters
-- 4. search_transactions_v2 RPC for single-query database-level search with window count
-- 5. Autovacuum tuning for high-write POS tables
-- 6. Cached auth function calls in RLS policies for 5-10x throughput boost

-- Step 1: Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: GIN Trigram Indexes for Substring Searches
-- Allows `ILIKE '%...%'` on txn_reference and token_number to use index scans instead of full table scans
CREATE INDEX IF NOT EXISTS idx_transactions_txn_ref_trgm
  ON public.transactions USING gin (txn_reference gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tokens_token_number_trgm
  ON public.tokens USING gin (token_number gin_trgm_ops);

-- Step 3: Composite & Partial Indexes for Day-to-Day Queries
-- Partial index on active (non-cancelled) transactions by created_at DESC
CREATE INDEX IF NOT EXISTS idx_transactions_active_created_at
  ON public.transactions (created_at DESC)
  WHERE cancelled_at IS NULL;

-- Composite partial index for cashier's active transactions
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_active_created_at
  ON public.transactions (cashier_id, created_at DESC)
  WHERE cancelled_at IS NULL;

-- Composite index for activity-based date searches
CREATE INDEX IF NOT EXISTS idx_transactions_activity_created_at
  ON public.transactions (activity_id, created_at DESC);

-- Covering lookup index on tokens
CREATE INDEX IF NOT EXISTS idx_tokens_txn_lookup
  ON public.tokens (transaction_id, token_number);

-- Step 4: Stored Procedure for Unified High-Speed Search
-- Replaces multi-step Node.js memory merging with a single SQL query
CREATE OR REPLACE FUNCTION public.search_transactions_v2(
  p_query text default null,
  p_cashier_id uuid default null,
  p_activity_id uuid default null,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_include_cancelled boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
RETURNS TABLE (
  id uuid,
  transaction_group_id uuid,
  cashier_id uuid,
  activity_id uuid,
  price_type public.price_type,
  amount numeric,
  token_index integer,
  token_total integer,
  txn_reference text,
  print_status public.print_status,
  printed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  payment_method public.payment_method_type,
  exchanged_to_transaction_id uuid,
  exchanged_from_transaction_id uuid,
  is_exchanged boolean,
  token_number text,
  full_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      t.id,
      t.transaction_group_id,
      t.cashier_id,
      t.activity_id,
      t.price_type,
      t.amount,
      t.token_index,
      t.token_total,
      t.txn_reference,
      t.print_status,
      t.printed_at,
      t.cancelled_at,
      t.created_at,
      t.updated_at,
      t.payment_method,
      t.exchanged_to_transaction_id,
      t.exchanged_from_transaction_id,
      t.is_exchanged,
      tk.token_number,
      count(*) over() AS full_count
    FROM public.transactions t
    LEFT JOIN public.tokens tk ON tk.transaction_id = t.id
    WHERE
      (p_cashier_id IS NULL OR t.cashier_id = p_cashier_id)
      AND (p_activity_id IS NULL OR t.activity_id = p_activity_id)
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_include_cancelled OR t.cancelled_at IS NULL OR t.is_exchanged = true)
      AND (
        p_query IS NULL
        OR p_query = ''
        OR t.txn_reference ILIKE ('%' || p_query || '%')
        OR tk.token_number ILIKE ('%' || p_query || '%')
      )
    ORDER BY t.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT * FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.search_transactions_v2(text, uuid, uuid, timestamptz, timestamptz, boolean, integer, integer) TO authenticated;

-- Step 5: Autovacuum Tuning for High-Write POS Tables
-- Default is 20% row updates before vacuum; setting to 5% keeps dead tuples low
-- and keeps B-tree/GIN index pages clean as hundreds of transactions occur daily.
ALTER TABLE public.transactions SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.tokens SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.audit_log SET (autovacuum_vacuum_scale_factor = 0.05);

-- Step 6: Optimize RLS Policies with Cached Subquery Evaluation
-- Wrap auth.uid() and auth.jwt() in (SELECT ...) so Postgres evaluates them
-- once per statement instead of once per table row.
DROP POLICY IF EXISTS "cashier_read_own_transactions" ON public.transactions;
CREATE POLICY "cashier_read_own_transactions"
  ON public.transactions FOR SELECT
  USING (cashier_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admin_read_all_transactions" ON public.transactions;
CREATE POLICY "admin_read_all_transactions"
  ON public.transactions FOR SELECT
  USING ((SELECT auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "cashier_read_own_tokens" ON public.tokens;
CREATE POLICY "cashier_read_own_tokens"
  ON public.tokens FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions WHERE cashier_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "admin_read_all_tokens" ON public.tokens;
CREATE POLICY "admin_read_all_tokens"
  ON public.tokens FOR SELECT
  USING ((SELECT auth.jwt() ->> 'role') = 'admin');
