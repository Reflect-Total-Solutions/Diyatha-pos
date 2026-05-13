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

    const body = await request.json();
    const { activity_id: newActivityId } = body;

    if (!newActivityId) {
      return NextResponse.json(
        { error: 'New Activity ID is required' },
        { status: 400 }
      );
    }

    const { data: rawOriginalTransaction, error: fetchError } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !rawOriginalTransaction) {
      console.error('Exchange: Error fetching original transaction:', fetchError);
      return NextResponse.json(
        { error: 'Original transaction not found' },
        { status: 404 }
      );
    }

    const originalTransaction = rawOriginalTransaction as any;

    if (originalTransaction.cancelled_at) {
      return NextResponse.json(
        { error: 'Cannot exchange a cancelled transaction' },
        { status: 400 }
      );
    }
    if (originalTransaction.exchanged_to_transaction_id) {
      return NextResponse.json(
        { error: 'This transaction has already been exchanged' },
        { status: 400 }
      );
    }

    const { data: rawNewActivity, error: actError } = await supabaseServer
      .from('activities')
      .select('*')
      .eq('id', newActivityId)
      .single();

    if (actError || !rawNewActivity) {
      return NextResponse.json(
        { error: 'New activity not found' },
        { status: 404 }
      );
    }

    const newActivity = rawNewActivity as any;

    const expectedPrice =
      originalTransaction.price_type === 'local'
        ? newActivity.local_price
        : newActivity.foreign_price;

    if (Number(expectedPrice) !== Number(originalTransaction.amount)) {
      return NextResponse.json(
        { error: 'Price mismatch. Exchange is only valid for activities with the exact same price.' },
        { status: 400 }
      );
    }

    // Generate a proper, system-consistent txn reference
    const txnRefResult = await supabaseServer.rpc('generate_txn_reference');
    const txnReference = txnRefResult.data as unknown as string | null;

    if (!txnReference) {
      return NextResponse.json(
        { error: 'Unable to generate transaction reference' },
        { status: 500 }
      );
    }

    // Insert the new transaction (no token_index/token_total yet — resequencing will set them)
    const { data: rawNewTx, error: insertTxError } = await supabaseServer
      .from('transactions')
      .insert({
        transaction_group_id: originalTransaction.transaction_group_id,
        cashier_id: user.id,
        activity_id: newActivityId,
        price_type: originalTransaction.price_type,
        amount: originalTransaction.amount,
        txn_reference: txnReference,
        print_status: 'pending',
        exchanged_from_transaction_id: transactionId,
      } as any)
      .select()
      .single();

    if (insertTxError || !rawNewTx) {
      console.error('Exchange: Error creating new transaction:', insertTxError);
      return NextResponse.json(
        { error: 'Failed to create exchanged transaction' },
        { status: 500 }
      );
    }

    const newTransaction = rawNewTx as any;

    // From here on, any failure must roll back the new transaction
    const rollback = async (stage: string, err: unknown) => {
      console.error(`Exchange: rollback at ${stage}:`, err);
      await supabaseServer.from('transactions').delete().eq('id', newTransaction.id);
    };

    // Cancel the original and link it to the replacement
    const { error: cancelError } = await supabaseServer
      .from('transactions')
      .update({
        cancelled_at: new Date().toISOString(),
        exchanged_to_transaction_id: newTransaction.id,
      } as never)
      .eq('id', transactionId);

    if (cancelError) {
      await rollback('cancel-original', cancelError);
      return NextResponse.json(
        { error: 'Failed to cancel original transaction' },
        { status: 500 }
      );
    }

    // Generate token number
    const generatedTokenResult = await supabaseServer.rpc('generate_token_number');
    const generatedToken = generatedTokenResult.data as unknown as string | null;

    if (!generatedToken) {
      await rollback('generate-token-number', generatedTokenResult.error);
      return NextResponse.json(
        { error: 'Unable to generate token number' },
        { status: 500 }
      );
    }

    // Resequence the group so token_index/token_total are consistent across siblings
    let sequenced;
    try {
      sequenced = await resequenceGroupTransactions(
        supabaseServer as any,
        originalTransaction.transaction_group_id
      );
    } catch (seqErr) {
      await rollback('resequence', seqErr);
      return NextResponse.json(
        { error: 'Failed to resequence transaction group' },
        { status: 500 }
      );
    }

    const tokenIndex =
      sequenced.transactions.findIndex((row: any) => row.id === newTransaction.id) + 1;
    const tokenTotal = sequenced.total;

    if (tokenIndex <= 0) {
      await rollback('resolve-token-position', null);
      return NextResponse.json(
        { error: 'Failed to resolve token position' },
        { status: 500 }
      );
    }

    const { utcNow } = getColomboDates();

    const { error: tokenError } = await supabaseServer
      .from('tokens')
      .insert({
        transaction_id: newTransaction.id,
        token_number: generatedToken,
        token_index: tokenIndex,
        token_total: tokenTotal,
        printed_at: utcNow.toISOString(),
      } as any);

    if (tokenError) {
      await rollback('insert-token', tokenError);
      return NextResponse.json(
        { error: 'Failed to create token for exchanged transaction' },
        { status: 500 }
      );
    }

    await supabaseServer.from('audit_log').insert({
      user_id: user.id,
      action: 'EXCHANGE',
      entity_type: 'transaction',
      entity_id: transactionId,
      metadata: {
        new_transaction_id: newTransaction.id,
        old_activity_id: originalTransaction.activity_id,
        new_activity_id: newActivityId,
        amount: originalTransaction.amount,
        token_number: generatedToken,
        token_index: tokenIndex,
        token_total: tokenTotal,
      },
    } as any);

    return NextResponse.json({
      success: true,
      original_id: transactionId,
      new_transaction: {
        ...newTransaction,
        token_index: tokenIndex,
        token_total: tokenTotal,
        token_number: generatedToken,
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
