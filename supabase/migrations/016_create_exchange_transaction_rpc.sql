-- 016_create_exchange_transaction_rpc.sql
--
-- Atomic ticket exchange. The entire flow (validate, insert new txn, cancel
-- original, resequence the group, allocate token) runs inside one Postgres
-- transaction so any failure rolls back all writes — no orphan rows, no
-- partial state.

create or replace function public.exchange_transaction(
  p_transaction_id uuid,
  p_new_activity_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_original public.transactions%rowtype;
  v_new_activity public.activities%rowtype;
  v_expected_price numeric(10,2);
  v_txn_reference text;
  v_token_number text;
  v_new_id uuid;
  v_new_row public.transactions%rowtype;
  v_token_index integer;
  v_token_total integer;
begin
  -- Lock the original row to serialize concurrent exchange attempts.
  select * into v_original
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Original transaction not found'
      using errcode = 'P0002', hint = 'not_found';
  end if;

  if v_original.cancelled_at is not null then
    raise exception 'Cannot exchange a cancelled transaction'
      using errcode = 'P0001', hint = 'cancelled';
  end if;

  if v_original.exchanged_to_transaction_id is not null then
    raise exception 'This transaction has already been exchanged'
      using errcode = 'P0001', hint = 'already_exchanged';
  end if;

  select * into v_new_activity
  from public.activities
  where id = p_new_activity_id;

  if not found then
    raise exception 'New activity not found'
      using errcode = 'P0002', hint = 'not_found';
  end if;

  if v_new_activity.is_active is distinct from true then
    raise exception 'Target activity is inactive'
      using errcode = 'P0001', hint = 'inactive_activity';
  end if;

  v_expected_price := case v_original.price_type
    when 'local' then v_new_activity.local_price
    when 'foreign' then v_new_activity.foreign_price
  end;

  if v_expected_price is null or v_expected_price <> v_original.amount then
    raise exception 'Price mismatch. Exchange is only valid for activities with the exact same price.'
      using errcode = 'P0001', hint = 'price_mismatch';
  end if;

  v_txn_reference := public.generate_txn_reference('E');
  v_token_number := public.generate_token_number();

  -- Insert the new transaction (token_index/token_total stay null until
  -- resequencing — the chk_transaction_token_pair constraint allows both null).
  insert into public.transactions (
    transaction_group_id,
    cashier_id,
    activity_id,
    price_type,
    amount,
    txn_reference,
    print_status,
    exchanged_from_transaction_id
  )
  values (
    v_original.transaction_group_id,
    p_user_id,
    p_new_activity_id,
    v_original.price_type,
    v_original.amount,
    v_txn_reference,
    'pending',
    p_transaction_id
  )
  returning id into v_new_id;

  -- Cancel the original and link the replacement.
  update public.transactions
  set cancelled_at = now(),
      exchanged_to_transaction_id = v_new_id
  where id = p_transaction_id;

  -- Resequence the entire group in one set-based pass: row_number() over the
  -- active siblings (now excluding the cancelled original) becomes the new
  -- token_index, count() the new token_total.
  with seq as (
    select id,
           row_number() over (order by created_at, id) as rn,
           count(*) over () as total
    from public.transactions
    where transaction_group_id = v_original.transaction_group_id
      and cancelled_at is null
  )
  update public.transactions t
  set token_index = seq.rn,
      token_total = seq.total
  from seq
  where t.id = seq.id;

  -- Mirror those numbers onto any existing tokens for the group's active txns.
  with seq as (
    select t.id as transaction_id,
           row_number() over (order by t.created_at, t.id) as rn,
           count(*) over () as total
    from public.transactions t
    where t.transaction_group_id = v_original.transaction_group_id
      and t.cancelled_at is null
  )
  update public.tokens tk
  set token_index = seq.rn,
      token_total = seq.total
  from seq
  where tk.transaction_id = seq.transaction_id;

  -- Read back the new transaction's resolved position.
  select * into v_new_row
  from public.transactions
  where id = v_new_id;

  v_token_index := v_new_row.token_index;
  v_token_total := v_new_row.token_total;

  if v_token_index is null or v_token_total is null then
    raise exception 'Failed to resolve token position for exchanged transaction'
      using errcode = 'P0001', hint = 'token_position';
  end if;

  -- Allocate the token row for the new transaction.
  insert into public.tokens (
    transaction_id,
    token_number,
    token_index,
    token_total,
    printed_at
  )
  values (
    v_new_id,
    v_token_number,
    v_token_index,
    v_token_total,
    now()
  );

  insert into public.audit_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_user_id,
    'EXCHANGE',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'new_transaction_id', v_new_id,
      'old_activity_id', v_original.activity_id,
      'new_activity_id', p_new_activity_id,
      'amount', v_original.amount,
      'token_number', v_token_number,
      'token_index', v_token_index,
      'token_total', v_token_total
    )
  );

  return jsonb_build_object(
    'success', true,
    'original_id', p_transaction_id,
    'new_transaction', jsonb_build_object(
      'id', v_new_row.id,
      'transaction_group_id', v_new_row.transaction_group_id,
      'cashier_id', v_new_row.cashier_id,
      'activity_id', v_new_row.activity_id,
      'price_type', v_new_row.price_type,
      'amount', v_new_row.amount,
      'token_index', v_token_index,
      'token_total', v_token_total,
      'token_number', v_token_number,
      'txn_reference', v_new_row.txn_reference,
      'print_status', v_new_row.print_status,
      'printed_at', v_new_row.printed_at,
      'cancelled_at', v_new_row.cancelled_at,
      'created_at', v_new_row.created_at,
      'updated_at', v_new_row.updated_at,
      'exchanged_from_transaction_id', v_new_row.exchanged_from_transaction_id,
      'exchanged_to_transaction_id', v_new_row.exchanged_to_transaction_id
    )
  );
end;
$$;
