-- 012_setup_rls_policies.sql

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.activities enable row level security;
alter table public.transaction_groups enable row level security;
alter table public.transactions enable row level security;
alter table public.tokens enable row level security;
alter table public.audit_log enable row level security;
alter table public.error_logs enable row level security;
alter table public.printer_status_cache enable row level security;

-- Users
create policy "users_read_own"
  on public.users
  for select
  using (id = auth.uid());

create policy "admin_read_all_users"
  on public.users
  for select
  using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_insert_users"
  on public.users
  for insert
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin_update_users"
  on public.users
  for update
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Categories
create policy "authenticated_read_categories"
  on public.categories
  for select
  to authenticated
  using (is_active = true);

create policy "admin_read_all_categories"
  on public.categories
  for select
  using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_insert_categories"
  on public.categories
  for insert
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin_update_categories"
  on public.categories
  for update
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin_delete_categories"
  on public.categories
  for delete
  using (auth.jwt() ->> 'role' = 'admin');

-- Activities
create policy "authenticated_read_activities"
  on public.activities
  for select
  to authenticated
  using (is_active = true);

create policy "admin_read_all_activities"
  on public.activities
  for select
  using (auth.jwt() ->> 'role' = 'admin');

create policy "admin_insert_activities"
  on public.activities
  for insert
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin_update_activities"
  on public.activities
  for update
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

create policy "admin_delete_activities"
  on public.activities
  for delete
  using (auth.jwt() ->> 'role' = 'admin');

-- Transaction groups
create policy "cashier_read_own_transaction_groups"
  on public.transaction_groups
  for select
  using (cashier_id = auth.uid());

create policy "cashier_insert_transaction_groups"
  on public.transaction_groups
  for insert
  with check (cashier_id = auth.uid());

create policy "admin_read_all_transaction_groups"
  on public.transaction_groups
  for select
  using (auth.jwt() ->> 'role' = 'admin');

-- Transactions
create policy "cashier_read_own_transactions"
  on public.transactions
  for select
  using (cashier_id = auth.uid());

create policy "cashier_insert_transactions"
  on public.transactions
  for insert
  with check (cashier_id = auth.uid());

create policy "admin_read_all_transactions"
  on public.transactions
  for select
  using (auth.jwt() ->> 'role' = 'admin');

-- Tokens
create policy "cashier_read_own_tokens"
  on public.tokens
  for select
  using (
    transaction_id in (
      select id
      from public.transactions
      where cashier_id = auth.uid()
    )
  );

create policy "cashier_insert_own_tokens"
  on public.tokens
  for insert
  with check (
    transaction_id in (
      select id
      from public.transactions
      where cashier_id = auth.uid()
    )
  );

create policy "admin_read_all_tokens"
  on public.tokens
  for select
  using (auth.jwt() ->> 'role' = 'admin');

-- Audit log
create policy "cashier_read_own_audit_log"
  on public.audit_log
  for select
  using (user_id = auth.uid());

create policy "authenticated_insert_audit_log"
  on public.audit_log
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "admin_read_all_audit_log"
  on public.audit_log
  for select
  using (auth.jwt() ->> 'role' = 'admin');

-- Error logs
create policy "admin_read_error_logs"
  on public.error_logs
  for select
  using (auth.jwt() ->> 'role' = 'admin');

create policy "authenticated_insert_error_logs"
  on public.error_logs
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Printer status cache
create policy "authenticated_read_printer_status"
  on public.printer_status_cache
  for select
  to authenticated
  using (true);

create policy "admin_manage_printer_status"
  on public.printer_status_cache
  for all
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');
