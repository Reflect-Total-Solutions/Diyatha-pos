import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { BulkTransactionSchema, validateInput } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreatedTransaction = TransactionRow & {
  token_number: string;
  token_index: number;
  token_total: number;
};

type BulkCheckoutResult = {
  transaction_group_id: string;
  transactions: CreatedTransaction[];
  transaction_count: number;
  total_amount: number;
  replayed: boolean;
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

    const { items, payment_method, idempotency_key } = validation.data;

    // The whole checkout — group, transactions, tokens, audit entry — happens
    // inside one Postgres function, so it either fully succeeds or leaves
    // nothing behind. The idempotency key makes retries replay the original
    // result instead of duplicating tickets.
    const { data, error } = await supabase.rpc('bulk_checkout' as never, {
      p_payment_method: payment_method || 'cash',
      p_items: items,
      p_idempotency_key: idempotency_key,
    } as never);

    if (error) {
      if (error.message.includes('Activity not found')) {
        return Response.json(
          {
            error: error.message,
            code: ERROR_CODES.NOT_FOUND,
          },
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }

      if (error.message.includes('uq_transaction_groups_idempotency_key')) {
        return Response.json(
          {
            error: 'This checkout is already being processed',
            code: ERROR_CODES.RESOURCE_CONFLICT,
          },
          { status: HTTP_STATUS.CONFLICT }
        );
      }

      throw error;
    }

    const result = data as unknown as BulkCheckoutResult | null;

    if (!result) {
      return Response.json(
        {
          error: 'Checkout failed',
          code: ERROR_CODES.TRANSACTION_FAILED,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    return Response.json(
      { data: result },
      { status: result.replayed ? HTTP_STATUS.OK : HTTP_STATUS.CREATED }
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
