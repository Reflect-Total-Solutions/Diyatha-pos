-- 020_atomic_bulk_checkout.sql
--
-- Fixes duplicate-ticket and group-merging bugs:
--  * bulk_checkout() creates the group, all transactions and all tokens in ONE
--    database transaction — a failure anywhere rolls back everything, so a
--    partial sale can never be left in the database.
--  * The group is created already completed (a checkout is final), so the next
--    sale can never be appended to it.
--  * A client-supplied idempotency key is stored on the group with a unique
--    constraint. A retried request replays the original result instead of
--    inserting a second set of tickets.
--  * txn_reference uses a sequence so two requests in the same millisecond can
--    no longer collide.
--
-- Additive only: new column, new sequence, new functions. No data is touched.

alter table public.transaction_groups
  add column if not exists idempotency_key uuid;

-- Postgres unique constraints allow multiple NULLs, so existing rows are unaffected.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_transaction_groups_idempotency_key'
  ) then
    alter table public.transaction_groups
      add constraint uq_transaction_groups_idempotency_key unique (idempotency_key);
  end if;
end
$$;

create sequence if not exists public.txn_reference_seq;

-- Builds the API response payload for a completed checkout group. Used both for
-- fresh checkouts and idempotent replays.
create or replace function public.bulk_checkout_result(p_group_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'transaction_group_id', p_group_id,
    'transaction_count', count(*),
    'total_amount', round(coalesce(sum(t.amount), 0)::numeric, 2),
    'transactions', coalesce(
      jsonb_agg(
        to_jsonb(t) || jsonb_build_object(
          'token_number', tk.token_number,
          'token_index', t.token_index,
          'token_total', t.token_total
        )
        order by t.token_index
      ),
      '[]'::jsonb
    )
  )
  from public.transactions t
  join public.tokens tk on tk.transaction_id = t.id
  where t.transaction_group_id = p_group_id
    and t.cancelled_at is null;
$$;

revoke execute on function public.bulk_checkout_result(uuid) from public, anon, authenticated;

create or replace function public.bulk_checkout(
  p_payment_method public.payment_method_type,
  p_items jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cashier uuid := auth.uid();
  v_existing_group uuid;
  v_group_id uuid;
  v_item jsonb;
  v_activity public.activities%rowtype;
  v_quantity integer;
  v_price_type public.price_type;
  v_amount numeric(10, 2);
  v_total integer := 0;
  v_idx integer := 0;
  v_txn_id uuid;
  v_token_number text;
  v_now timestamptz := now();
begin
  if v_cashier is null then
    raise exception 'Not authenticated';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required';
  end if;

  -- Idempotent replay: this exact checkout was already processed, return the
  -- original tickets instead of creating new ones.
  select id into v_existing_group
  from public.transaction_groups
  where idempotency_key = p_idempotency_key;

  if v_existing_group is not null then
    return public.bulk_checkout_result(v_existing_group)
      || jsonb_build_object('replayed', true);
  end if;

  -- Total ticket count up front so every ticket carries the right "N of total".
  select coalesce(sum(greatest(1, coalesce((item->>'quantity')::integer, 1))), 0)
  into v_total
  from jsonb_array_elements(p_items) as item;

  if v_total < 1 or v_total > 1000 then
    raise exception 'Invalid ticket count: %', v_total;
  end if;

  -- The group is created already completed: a checkout is final, nothing can be
  -- appended to it later. A concurrent request with the same idempotency key
  -- fails here on the unique constraint and rolls back entirely.
  insert into public.transaction_groups (cashier_id, payment_method, idempotency_key, started_at, completed_at)
  values (v_cashier, p_payment_method, p_idempotency_key, v_now, v_now)
  returning id into v_group_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    v_price_type := (v_item->>'price_type')::public.price_type;

    select * into v_activity
    from public.activities
    where id = (v_item->>'activity_id')::uuid
      and is_active = true;

    if not found then
      raise exception 'Activity not found or inactive: %', v_item->>'activity_id';
    end if;

    v_amount := case when v_price_type = 'local'
      then v_activity.local_price
      else v_activity.foreign_price
    end;

    for i in 1..v_quantity loop
      v_idx := v_idx + 1;

      insert into public.transactions (
        transaction_group_id, cashier_id, activity_id, price_type,
        payment_method, amount, token_index, token_total,
        txn_reference, print_status
      )
      values (
        v_group_id, v_cashier, v_activity.id, v_price_type,
        p_payment_method, v_amount, v_idx, v_total,
        'TXN-'
          || to_char(v_now at time zone 'Asia/Colombo', 'YYYYMMDDHH24MISS')
          || '-' || lpad(nextval('public.txn_reference_seq')::text, 6, '0')
          || '-S',
        'pending'
      )
      returning id into v_txn_id;

      v_token_number := public.generate_token_number();

      insert into public.tokens (transaction_id, token_number, token_index, token_total, printed_at)
      values (v_txn_id, v_token_number, v_idx, v_total, v_now);
    end loop;
  end loop;

  insert into public.audit_log (user_id, action, entity_type, entity_id, metadata, created_at)
  values (
    v_cashier,
    'BULK_CHECKOUT',
    'transaction_group',
    v_group_id,
    jsonb_build_object(
      'ticket_count', v_total,
      'payment_method', p_payment_method,
      'idempotency_key', p_idempotency_key,
      'items', p_items
    ),
    v_now
  );

  return public.bulk_checkout_result(v_group_id)
    || jsonb_build_object('replayed', false);
end;
$$;

revoke execute on function public.bulk_checkout(public.payment_method_type, jsonb, uuid) from public, anon;
grant execute on function public.bulk_checkout(public.payment_method_type, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
