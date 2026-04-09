-- 007_create_audit_log.sql

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at_desc
  on public.audit_log(created_at desc);

create index if not exists idx_audit_log_user_id
  on public.audit_log(user_id);
