-- 010_setup_sequences_and_functions.sql

create sequence if not exists public.daily_token_seq
  increment by 1
  minvalue 1
  maxvalue 9999
  start with 1
  cycle;

create or replace function public.generate_token_number()
returns text
language plpgsql
as $$
declare
  v_seq integer;
begin
  v_seq := nextval('public.daily_token_seq');

  return 'CWPCCMB-'
    || to_char(now() at time zone 'Asia/Colombo', 'YYYYMMDD')
    || '-'
    || lpad(v_seq::text, 4, '0');
end;
$$;

create or replace function public.generate_txn_reference(suffix text default 'S')
returns text
language sql
as $$
  select 'TXN-'
    || to_char(now() at time zone 'Asia/Colombo', 'YYYYMMDDHH24MISSMS')
    || '-'
    || coalesce(nullif(trim(suffix), ''), 'S');
$$;

create or replace function public.reset_daily_token_sequence()
returns void
language sql
as $$
  alter sequence public.daily_token_seq restart with 1;
$$;
