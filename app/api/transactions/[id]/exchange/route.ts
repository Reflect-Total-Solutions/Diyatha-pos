import { NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';

type RpcHint =
  | 'cancelled'
  | 'already_exchanged'
  | 'price_mismatch'
  | 'inactive_activity'
  | 'not_found'
  | 'token_position';

function statusForHint(hint: string | null | undefined): number {
  switch (hint as RpcHint) {
    case 'not_found':
      return 404;
    case 'cancelled':
    case 'already_exchanged':
    case 'price_mismatch':
    case 'inactive_activity':
      return 400;
    default:
      return 500;
  }
}

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

    const { data, error } = await supabaseServer.rpc('exchange_transaction', {
      p_transaction_id: transactionId,
      p_new_activity_id: newActivityId,
      p_user_id: user.id,
    } as never);

    if (error) {
      const status = statusForHint(error.hint);
      console.error('Exchange RPC error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to exchange transaction' },
        { status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing exchange' },
      { status: 500 }
    );
  }
}
