-- 008_create_error_logs.sql

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  message text not null,
  stack text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_error_logs_created_at_desc
  on public.error_logs(created_at desc);

create index if not exists idx_error_logs_user_id
  on public.error_logs(user_id);
