-- 025_fix_rls_admin_policies.sql
--
-- Fixes RLS policies where `auth.jwt() ->> 'role' = 'admin'` was used.
-- In Supabase, `auth.jwt() ->> 'role'` returns the Postgres role ('authenticated'),
-- NOT the application role ('admin').
-- This helper function checks app_metadata, user_metadata, and the public.users table.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Categories RLS
DROP POLICY IF EXISTS "admin_read_all_categories" ON public.categories;
CREATE POLICY "admin_read_all_categories"
  ON public.categories FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_categories" ON public.categories;
CREATE POLICY "admin_insert_categories"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_categories" ON public.categories;
CREATE POLICY "admin_update_categories"
  ON public.categories FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_categories" ON public.categories;
CREATE POLICY "admin_delete_categories"
  ON public.categories FOR DELETE
  USING (public.is_admin());

-- Activities RLS
DROP POLICY IF EXISTS "admin_read_all_activities" ON public.activities;
CREATE POLICY "admin_read_all_activities"
  ON public.activities FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_activities" ON public.activities;
CREATE POLICY "admin_insert_activities"
  ON public.activities FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_activities" ON public.activities;
CREATE POLICY "admin_update_activities"
  ON public.activities FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_activities" ON public.activities;
CREATE POLICY "admin_delete_activities"
  ON public.activities FOR DELETE
  USING (public.is_admin());

-- Users RLS
DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
CREATE POLICY "admin_read_all_users"
  ON public.users FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_users" ON public.users;
CREATE POLICY "admin_insert_users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_users" ON public.users;
CREATE POLICY "admin_update_users"
  ON public.users FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Transaction Groups RLS
DROP POLICY IF EXISTS "admin_read_all_transaction_groups" ON public.transaction_groups;
CREATE POLICY "admin_read_all_transaction_groups"
  ON public.transaction_groups FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_all_transaction_groups" ON public.transaction_groups;
CREATE POLICY "admin_update_all_transaction_groups"
  ON public.transaction_groups FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Transactions RLS
DROP POLICY IF EXISTS "admin_read_all_transactions" ON public.transactions;
CREATE POLICY "admin_read_all_transactions"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_all_transactions" ON public.transactions;
CREATE POLICY "admin_update_all_transactions"
  ON public.transactions FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tokens RLS
DROP POLICY IF EXISTS "admin_read_all_tokens" ON public.tokens;
CREATE POLICY "admin_read_all_tokens"
  ON public.tokens FOR SELECT
  USING (public.is_admin());

-- Audit Log RLS
DROP POLICY IF EXISTS "admin_read_all_audit_log" ON public.audit_log;
CREATE POLICY "admin_read_all_audit_log"
  ON public.audit_log FOR SELECT
  USING (public.is_admin());

-- Error Logs RLS
DROP POLICY IF EXISTS "admin_read_error_logs" ON public.error_logs;
CREATE POLICY "admin_read_error_logs"
  ON public.error_logs FOR SELECT
  USING (public.is_admin());
