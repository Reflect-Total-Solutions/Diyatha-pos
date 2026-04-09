import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { BulkTransactionSchema, validateInput } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type TransactionGroupRow = Database['public']['Tables']['transaction_groups']['Row'];
type TransactionGroupInsert = Database['public']['Tables']['transaction_groups']['Insert'];
type TokenInsert = Database['public']['Tables']['tokens']['Insert'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreatedTransaction = TransactionRow & {
  token_number: string;
  token_index: number;
  token_total: number;
};

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transactions:bulk:${user.id}`,
      RATE_LIMITS.ADMIN_MUTATIONS.attempts,
      RATE_LIMITS.ADMIN_MUTATIONS.windowMs
    );

    if (!allowed) {
      return Response.json(
        {
          error: 'Too many requests',
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const payload = await request.json().catch(() => null);
    const validation = validateInput(BulkTransactionSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid bulk transaction payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { items, transaction_group_id } = validation.data;

    // Collect all unique activity IDs
    const activityIds = [...new Set(items.map((item) => item.activity_id))];

    // Fetch all activities at once
    const { data: activityData, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .in('id', activityIds)
      .eq('is_active', true);

    if (activityError) {
      throw activityError;
    }

    const activityRows = (activityData ?? []) as unknown as ActivityRow[];
    const activityMap = new Map(activityRows.map((a) => [a.id, a]));

    // Validate all activities exist and are active
    for (const item of items) {
      if (!activityMap.has(item.activity_id)) {
        return Response.json(
          {
            error: `Activity not found or inactive: ${item.activity_id}`,
            code: ERROR_CODES.NOT_FOUND,
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }
    }

    // Resolve or create the transaction group
    let groupId = transaction_group_id;

    if (groupId) {
      const { data: groupData, error: groupError } = await supabase
        .from('transaction_groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (groupError) {
        throw groupError;
      }

      const groupRecord = groupData as unknown as TransactionGroupRow | null;

      if (!groupRecord) {
        return Response.json(
          {
            error: 'Transaction group not found',
            code: ERROR_CODES.NOT_FOUND,
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }

      if (groupRecord.completed_at) {
        return Response.json(
          {
            error: 'Transaction group is already completed',
            code: ERROR_CODES.RESOURCE_CONFLICT,
          },
          { status: HTTP_STATUS.CONFLICT }
        );
      }

      if (user.role !== 'admin' && groupRecord.cashier_id !== user.id) {
        return Response.json(
          {
            error: 'Forbidden',
            code: ERROR_CODES.FORBIDDEN,
          },
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }
    } else {
      // Create a new transaction group
      const insertPayload: TransactionGroupInsert = {
        cashier_id: user.id,
        notes: null,
      };

      const { data: newGroup, error: newGroupError } = await supabase
        .from('transaction_groups')
        .insert(insertPayload as never)
        .select('*')
        .maybeSingle();

      if (newGroupError) {
        throw newGroupError;
      }

      const groupRecord = newGroup as unknown as TransactionGroupRow | null;

      if (!groupRecord) {
        return Response.json(
          {
            error: 'Failed to create transaction group',
            code: ERROR_CODES.DATABASE_ERROR,
          },
          { status: HTTP_STATUS.SERVER_ERROR }
        );
      }

      groupId = groupRecord.id;

      await supabase.from('audit_log').insert(
        {
          user_id: user.id,
          action: 'START_GROUP',
          entity_type: 'transaction_group',
          entity_id: groupId,
          metadata: { source: 'bulk_transaction' },
          created_at: new Date().toISOString(),
        } as never
      );
    }

    // Expand items into individual ticket entries
    // e.g. [{activity_id: A, quantity: 2, price_type: 'local'}] -> 2 entries
    const expandedTickets: Array<{ activity: ActivityRow; priceType: 'local' | 'foreign' }> = [];

    for (const item of items) {
      const activity = activityMap.get(item.activity_id)!;
      const qty = Math.max(1, item.quantity);

      for (let i = 0; i < qty; i++) {
        expandedTickets.push({ activity, priceType: item.price_type });
      }
    }

    if (expandedTickets.length === 0) {
      return Response.json(
        {
          error: 'No tickets to create',
          code: ERROR_CODES.VALIDATION_ERROR,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Create all transactions
    const createdTransactions: CreatedTransaction[] = [];

    for (let idx = 0; idx < expandedTickets.length; idx++) {
      const { activity, priceType: ticketPriceType } = expandedTickets[idx];
      const amount =
        ticketPriceType === 'local' ? activity.local_price : activity.foreign_price;

      // Generate unique txn reference
      const txnRefResult = await supabase.rpc('generate_txn_reference');
      const txnReference = txnRefResult.data as unknown as string | null;

      if (!txnReference) {
        return Response.json(
          {
            error: 'Unable to generate transaction reference',
            code: ERROR_CODES.TRANSACTION_FAILED,
          },
          { status: HTTP_STATUS.SERVER_ERROR }
        );
      }

      const insertPayload: TransactionInsert = {
        transaction_group_id: groupId,
        cashier_id: user.id,
        activity_id: activity.id,
        price_type: ticketPriceType,
        amount,
        txn_reference: txnReference,
        print_status: 'pending',
      };

      const { data: txnData, error: txnError } = await supabase
        .from('transactions')
        .insert(insertPayload as never)
        .select('*')
        .maybeSingle();

      if (txnError) {
        throw txnError;
      }

      const transactionRecord = txnData as unknown as TransactionRow | null;

      if (!transactionRecord) {
        return Response.json(
          {
            error: `Failed to create transaction ${idx + 1}`,
            code: ERROR_CODES.DATABASE_ERROR,
          },
          { status: HTTP_STATUS.SERVER_ERROR }
        );
      }

      // Generate token number
      const generatedTokenResult = await supabase.rpc('generate_token_number');
      const generatedToken = generatedTokenResult.data as unknown as string | null;

      if (!generatedToken) {
        return Response.json(
          {
            error: 'Unable to generate token number',
            code: ERROR_CODES.TRANSACTION_FAILED,
          },
          { status: HTTP_STATUS.SERVER_ERROR }
        );
      }

      const tokenIndex = idx + 1;
      const tokenTotal = expandedTickets.length;

      // Update transaction with token position
      await supabase
        .from('transactions')
        .update(
          {
            token_index: tokenIndex,
            token_total: tokenTotal,
          } as never
        )
        .eq('id', transactionRecord.id);

      const tokenPayload: TokenInsert = {
        transaction_id: transactionRecord.id,
        token_number: generatedToken,
        token_index: tokenIndex,
        token_total: tokenTotal,
        printed_at: new Date().toISOString(),
      };

      await supabase.from('tokens').insert(tokenPayload as never);

      createdTransactions.push({
        ...transactionRecord,
        amount,
        token_number: generatedToken,
        token_index: tokenIndex,
        token_total: tokenTotal,
      });
    }

    // Also update any pre-existing transactions in the group for correct token_total
    // (if adding to an existing group that already had transactions)
    const { data: allGroupTxns } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_group_id', groupId)
      .is('cancelled_at', null)
      .order('created_at', { ascending: true });

    const allTxnIds = ((allGroupTxns ?? []) as unknown as Array<{ id: string }>).map((t) => t.id);
    const finalTotal = allTxnIds.length;

    // Update token_total on all transactions in the group
    for (let i = 0; i < allTxnIds.length; i++) {
      await supabase
        .from('transactions')
        .update({ token_index: i + 1, token_total: finalTotal } as never)
        .eq('id', allTxnIds[i]);

      await supabase
        .from('tokens')
        .update({ token_index: i + 1, token_total: finalTotal } as never)
        .eq('transaction_id', allTxnIds[i]);
    }

    // Update our return data with correct indices
    for (let i = 0; i < createdTransactions.length; i++) {
      const globalIdx = allTxnIds.indexOf(createdTransactions[i].id);
      if (globalIdx >= 0) {
        createdTransactions[i].token_index = globalIdx + 1;
        createdTransactions[i].token_total = finalTotal;
      }
    }

    // Audit log
    await supabase.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'BULK_CREATE',
        entity_type: 'transaction',
        entity_id: groupId,
        metadata: {
          transaction_group_id: groupId,
          ticket_count: createdTransactions.length,
          items: items.map((item) => ({
            activity_id: item.activity_id,
            quantity: item.quantity,
          })),
          total_amount: createdTransactions.reduce((sum, t) => sum + t.amount, 0),
        },
        created_at: new Date().toISOString(),
      } as never
    );

    // Compute group stats
    const totalAmount = createdTransactions.reduce((sum, t) => sum + t.amount, 0);

    return Response.json(
      {
        data: {
          transaction_group_id: groupId,
          transactions: createdTransactions,
          transaction_count: finalTotal,
          total_amount: Number(totalAmount.toFixed(2)),
        },
      },
      { status: HTTP_STATUS.CREATED }
    );
  } catch (error) {
    const apiError = toApiError(error);

    return Response.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
      },
      { status: apiError.statusCode }
    );
  }
}
