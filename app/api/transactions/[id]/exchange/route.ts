import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';
import { resequenceGroupTransactions } from '@/lib/transactions';
import { getColomboDates } from '@/lib/dateUtils';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();

    const { id: transactionId } = await params;
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const newActivityId = body?.activity_id as string | undefined;
    if (!newActivityId) {
      return NextResponse.json(
        { error: 'New Activity ID is required' },
        { status: 400 }
      );
    }

    // 1. Fetch + validate original
    const { data: rawOriginal, error: fetchError } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !rawOriginal) {
      return NextResponse.json(
        { error: 'Original transaction not found' },
        { status: 404 }
      );
    }
    const original = rawOriginal as any;

    if (original.cancelled_at) {
      return NextResponse.json(
        { error: 'Cannot exchange a cancelled transaction' },
        { status: 400 }
      );
    }
    if (
      original.is_exchanged ||
      original.exchanged_to_transaction_id ||
      original.exchanged_from_transaction_id
    ) {
      return NextResponse.json(
        { error: 'This transaction has already been exchanged' },
        { status: 400 }
      );
    }

    // 2. Fetch + validate new activity
    const { data: rawActivity, error: actError } = await supabaseServer
      .from('activities')
      .select('*')
      .eq('id', newActivityId)
      .single();

    if (actError || !rawActivity) {
      return NextResponse.json(
        { error: 'New activity not found' },
        { status: 404 }
      );
    }
    const newActivity = rawActivity as any;

    if (newActivity.is_active === false) {
      return NextResponse.json(
        { error: 'Target activity is inactive' },
        { status: 400 }
      );
    }

    const expectedPrice =
      original.price_type === 'local'
        ? newActivity.local_price
        : newActivity.foreign_price;

    if (Number(expectedPrice) !== Number(original.amount)) {
      return NextResponse.json(
        { error: 'Price mismatch. Exchange is only valid for activities with the exact same price.' },
        { status: 400 }
      );
    }

    // 3. Generate reference + token via existing helpers
    const txnRefResult = await supabaseServer.rpc('generate_txn_reference', { suffix: 'E' } as never);
    const txnReference = txnRefResult.data as unknown as string | null;
    if (!txnReference) {
      return NextResponse.json(
        { error: 'Unable to generate transaction reference' },
        { status: 500 }
      );
    }

    const tokenNumberResult = await supabaseServer.rpc('generate_token_number');
    const tokenNumber = tokenNumberResult.data as unknown as string | null;
    if (!tokenNumber) {
      return NextResponse.json(
        { error: 'Unable to generate token number' },
        { status: 500 }
      );
    }

    // 4. Insert new transaction (token_index/total left null → resequence sets them)
    const { data: rawNew, error: insertErr } = await supabaseServer
      .from('transactions')
      .insert({
        transaction_group_id: original.transaction_group_id,
        cashier_id: user.id,
        activity_id: newActivityId,
        price_type: original.price_type,
        amount: original.amount,
        txn_reference: txnReference,
        print_status: 'pending',
        exchanged_from_transaction_id: transactionId,
        is_exchanged: true,
      } as any)
      .select()
      .single();

    if (insertErr || !rawNew) {
      console.error('Exchange: insert new transaction failed:', insertErr);
      return NextResponse.json(
        { error: 'Failed to create exchanged transaction' },
        { status: 500 }
      );
    }
    const newTxn = rawNew as any;

    // Rollback helpers — track what committed so we can undo in reverse.
    let originalMutated = false;
    const rollback = async (stage: string, err: unknown) => {
      console.error(`Exchange: rollback at ${stage}:`, err);
      if (originalMutated) {
        await supabaseServer
          .from('transactions')
          .update({
            cancelled_at: null,
            exchanged_to_transaction_id: null,
            is_exchanged: false,
          } as never)
          .eq('id', transactionId);
      }
      await supabaseServer.from('transactions').delete().eq('id', newTxn.id);
    };

    // 5. Cancel original + flag + link to replacement
    const { error: cancelErr } = await supabaseServer
      .from('transactions')
      .update({
        cancelled_at: new Date().toISOString(),
        exchanged_to_transaction_id: newTxn.id,
        is_exchanged: true,
      } as never)
      .eq('id', transactionId);

    if (cancelErr) {
      await rollback('cancel-original', cancelErr);
      return NextResponse.json(
        { error: 'Failed to cancel original transaction' },
        { status: 500 }
      );
    }
    originalMutated = true;

    // 6. Resequence the active siblings (cancelled original is now excluded)
    let sequenced;
    try {
      sequenced = await resequenceGroupTransactions(
        supabaseServer as any,
        original.transaction_group_id
      );
    } catch (seqErr) {
      await rollback('resequence', seqErr);
      return NextResponse.json(
        { error: 'Failed to resequence transaction group' },
        { status: 500 }
      );
    }

    const tokenIndex =
      sequenced.transactions.findIndex((row: any) => row.id === newTxn.id) + 1;
    const tokenTotal = sequenced.total;

    if (tokenIndex <= 0) {
      await rollback('resolve-token-position', null);
      return NextResponse.json(
        { error: 'Failed to resolve token position' },
        { status: 500 }
      );
    }

    // 7. Insert token row
    const { utcNow } = getColomboDates();
    const { error: tokenErr } = await supabaseServer
      .from('tokens')
      .insert({
        transaction_id: newTxn.id,
        token_number: tokenNumber,
        token_index: tokenIndex,
        token_total: tokenTotal,
        printed_at: utcNow.toISOString(),
      } as any);

    if (tokenErr) {
      await rollback('insert-token', tokenErr);
      return NextResponse.json(
        { error: 'Failed to create token for exchanged transaction' },
        { status: 500 }
      );
    }

    // 8. Audit log (non-blocking — failures here shouldn't undo the exchange)
    await supabaseServer.from('audit_log').insert({
      user_id: user.id,
      action: 'EXCHANGE',
      entity_type: 'transaction',
      entity_id: transactionId,
      metadata: {
        new_transaction_id: newTxn.id,
        old_activity_id: original.activity_id,
        new_activity_id: newActivityId,
        amount: original.amount,
        token_number: tokenNumber,
        token_index: tokenIndex,
        token_total: tokenTotal,
      },
    } as any);

    return NextResponse.json({
      success: true,
      original_id: transactionId,
      new_transaction: {
        ...newTxn,
        token_index: tokenIndex,
        token_total: tokenTotal,
        token_number: tokenNumber,
      },
    });
  } catch (error) {
    console.error('Exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing exchange' },
      { status: 500 }
    );
  }
}
