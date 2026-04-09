-- 009_create_printer_status_cache.sql

create table if not exists public.printer_status_cache (
  id uuid primary key default gen_random_uuid(),
  printer_ip text not null,
  port integer not null default 9100,
  is_online boolean not null default false,
  last_checked_at timestamptz not null default now(),
  error_message text,
  updated_at timestamptz not null default now(),
  constraint uq_printer_status_cache unique (printer_ip, port)
);

create index if not exists idx_printer_status_cache_ip
  on public.printer_status_cache(printer_ip);

create index if not exists idx_printer_status_cache_last_checked_at_desc
  on public.printer_status_cache(last_checked_at desc);

drop trigger if exists trg_printer_status_cache_set_updated_at on public.printer_status_cache;
create trigger trg_printer_status_cache_set_updated_at
before update on public.printer_status_cache
for each row
execute function public.set_updated_at();
