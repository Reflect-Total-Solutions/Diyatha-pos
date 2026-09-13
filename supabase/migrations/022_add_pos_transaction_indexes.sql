-- 022_add_pos_transaction_indexes.sql
--
-- Speeds up the POS dashboard transaction-history query
-- (GET /api/transactions), which filters by cashier_id + created_at range
-- and orders by created_at desc. The existing single-column indexes
-- (idx_transactions_cashier_id, idx_transactions_created_at_desc) cannot
-- serve the equality-filter + ordered-range together, so Postgres was
-- either scanning across other cashiers' rows or sorting on every load.
-- The admin dashboard is unaffected because it does not filter by cashier.
--
-- PROD-SAFE APPLY NOTES:
--   * Uses CREATE INDEX CONCURRENTLY so existing rows stay writable
--     (no INSERT/UPDATE lock) while the index builds. Sales are not blocked.
--   * CONCURRENTLY cannot run inside a transaction block. Apply this file
--     directly (Supabase SQL editor, `psql`, or the Supabase MCP), NOT via a
--     runner that wraps each migration in BEGIN/COMMIT.
--   * Nothing here drops tables, deletes, or rewrites data.
--   * IF NOT EXISTS makes re-runs safe.

-- Composite index: serves `cashier_id = ? ORDER BY created_at DESC` and the
-- created_at range filter in one index. This is the primary fix.
create index concurrently if not exists idx_transactions_cashier_created_at
  on public.transactions (cashier_id, created_at desc);
