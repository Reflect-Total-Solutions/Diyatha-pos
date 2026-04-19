import { z } from 'zod';

import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { validateInput } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resequenceGroupTransactions } from '@/lib/transactions';
import type { Database } from '@/types/database';

const CancelTransactionSchema = z.object({
  action: z.literal('cancel'),
  reason: z.string().optional(),
  cancelCode: z.string(),
});

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

type TransactionToken = {
  token_number: string;
  token_index: number;
  token_total: number;
  reprint_count: number;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const allowed = rateLimit(
      `transactions:get:${user.id}`,
      RATE_LIMITS.READ_OPERATIONS.attempts,
      RATE_LIMITS.READ_OPERATIONS.windowMs
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

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const transactionRecord = data as unknown as TransactionRow | null;

    if (!transactionRecord) {
      return Response.json(
        {
          error: 'Transaction not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (user.role !== 'admin' && transactionRecord.cashier_id !== user.id) {
      return Response.json(
        {
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const { data: tokenData } = await supabase
      .from('tokens')
      .select('token_number, token_index, token_total, reprint_count')
      .eq('transaction_id', transactionRecord.id)
      .maybeSingle();

    const token = (tokenData ?? null) as TransactionToken | null;

    return Response.json(
      {
        data: {
          ...transactionRecord,
          token_number: token?.token_number ?? null,
          token_index: token?.token_index ?? transactionRecord.token_index,
          token_total: token?.token_total ?? transactionRecord.token_total,
          reprint_count: token?.reprint_count ?? 0,
        },
      },
      { status: HTTP_STATUS.OK }
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

    const allowed = rateLimit(
      `transactions:update:${user.id}`,
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
    const validation = validateInput(CancelTransactionSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid transaction update payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    if (validation.data.cancelCode !== process.env.CANCEL_CODE) {
      return Response.json(
        {
          error: 'Invalid cancellation code',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const transactionRecord = data as unknown as TransactionRow | null;

    if (!transactionRecord) {
      return Response.json(
        {
          error: 'Transaction not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (user.role !== 'admin' && transactionRecord.cashier_id !== user.id) {
      return Response.json(
        {
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    if (transactionRecord.cancelled_at) {
      return Response.json(
        {
          error: 'Transaction is already cancelled',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    const cancelledAt = new Date().toISOString();

    const { data: updatedData, error: updateError } = await supabase
      .from('transactions')
      .update({ cancelled_at: cancelledAt } as never)
      .eq('id', transactionRecord.id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    await resequenceGroupTransactions(supabase, transactionRecord.transaction_group_id);

    await supabase.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'CANCEL',
        entity_type: 'transaction',
        entity_id: transactionRecord.id,
        metadata: {
          reason: validation.data.reason ?? null,
          cancelled_at: cancelledAt,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    const updatedRecord = updatedData as unknown as TransactionRow | null;

    return Response.json(
      {
        data: updatedRecord,
      },
      { status: HTTP_STATUS.OK }
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
