import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { formatColomboDate } from '@/lib/dateUtils';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { RefundTokenSchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import { resequenceGroupTransactions } from '@/lib/transactions';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TokenRow = Database['public']['Tables']['tokens']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'] & {
  exchanged_to_transaction_id?: string | null;
  exchanged_from_transaction_id?: string | null;
  is_exchanged?: boolean;
  payment_method?: string;
};

type LookupResult =
  | { ok: true; token: TokenRow; transaction: TransactionRow }
  | { ok: false; status: number; error: string; code: string };

// Case-insensitive exact-match lookup of a token plus its transaction, with
// the ticket's issue date validated against the admin-selected date.
async function lookupToken(tokenNumber: string, date: string): Promise<LookupResult> {
  const escaped = tokenNumber.replace(/[%_]/g, (char) => `\\${char}`);

  const { data: tokenData, error: tokenError } = await supabaseServer
    .from('tokens')
    .select('*')
    .ilike('token_number', escaped)
    .maybeSingle();

  if (tokenError) {
    throw tokenError;
  }

  const token = tokenData as unknown as TokenRow | null;

  if (!token) {
    return {
      ok: false,
      status: HTTP_STATUS.NOT_FOUND,
      error: `No token found with number "${tokenNumber}". It may have already been refunded or never existed.`,
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  const { data: txnData, error: txnError } = await supabaseServer
    .from('transactions')
    .select('*')
    .eq('id', token.transaction_id)
    .maybeSingle();

  if (txnError) {
    throw txnError;
  }

  const transaction = txnData as unknown as TransactionRow | null;

  if (!transaction) {
    return {
      ok: false,
      status: HTTP_STATUS.NOT_FOUND,
      error: 'The transaction for this token no longer exists.',
      code: ERROR_CODES.NOT_FOUND,
    };
  }

  const issuedDate = formatColomboDate(new Date(transaction.created_at), 'yyyy-MM-dd');
  if (issuedDate !== date) {
    return {
      ok: false,
      status: HTTP_STATUS.BAD_REQUEST,
      error: `Token ${token.token_number} was issued on ${issuedDate}, not ${date}. Correct the date to proceed.`,
      code: ERROR_CODES.VALIDATION_ERROR,
    };
  }

  return { ok: true, token, transaction };
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:refund:search:${admin.id}`,
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

    const searchParams = new URL(request.url).searchParams;
    const validation = validateInput(RefundTokenSchema, {
      token_number: searchParams.get('token') ?? '',
      date: searchParams.get('date') ?? '',
    });

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid refund search parameters',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const lookup = await lookupToken(validation.data.token_number, validation.data.date);

    if (!lookup.ok) {
      return Response.json(
        { error: lookup.error, code: lookup.code },
        { status: lookup.status }
      );
    }

    const { token, transaction } = lookup;

    const [activityResult, cashierResult] = await Promise.all([
      supabaseServer
        .from('activities')
        .select('name')
        .eq('id', transaction.activity_id)
        .maybeSingle(),
      supabaseServer
        .from('users')
        .select('display_name')
        .eq('id', transaction.cashier_id)
        .maybeSingle(),
    ]);

    const activityName =
      (activityResult.data as { name?: string } | null)?.name ?? 'Unknown Activity';
    const cashierName =
      (cashierResult.data as { display_name?: string } | null)?.display_name ?? 'Unknown';

    return Response.json(
      {
        data: {
          token_number: token.token_number,
          token_index: token.token_index,
          token_total: token.token_total,
          transaction_id: transaction.id,
          txn_reference: transaction.txn_reference,
          activity_name: activityName,
          amount: transaction.amount,
          price_type: transaction.price_type,
          payment_method: transaction.payment_method ?? 'cash',
          cashier_name: cashierName,
          created_at: transaction.created_at,
          status: transaction.cancelled_at ? 'cancelled' : 'active',
          exchanged: Boolean(transaction.exchanged_to_transaction_id),
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

export async function POST(request: Request) {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:refund:execute:${admin.id}`,
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
    const validation = validateInput(RefundTokenSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid refund payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const lookup = await lookupToken(validation.data.token_number, validation.data.date);

    if (!lookup.ok) {
      return Response.json(
        { error: lookup.error, code: lookup.code },
        { status: lookup.status }
      );
    }

    const { token, transaction } = lookup;

    if (transaction.cancelled_at) {
      return Response.json(
        {
          error: transaction.exchanged_to_transaction_id
            ? 'This ticket was exchanged; its transaction is already cancelled. Refund the replacement ticket instead.'
            : 'This transaction is already cancelled or refunded.',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    const refundedAt = new Date().toISOString();

    // 1. Cancel the transaction first; the conditional filter makes a
    // concurrent duplicate refund lose the race instead of double-applying.
    const { data: cancelledRows, error: cancelErr } = await supabaseServer
      .from('transactions')
      .update({ cancelled_at: refundedAt } as never)
      .eq('id', transaction.id)
      .is('cancelled_at', null)
      .select('id');

    if (cancelErr) {
      throw cancelErr;
    }

    if (!cancelledRows || (cancelledRows as unknown[]).length === 0) {
      return Response.json(
        {
          error: 'This transaction is already cancelled or refunded.',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    // 2. Permanently remove the token. If this fails, revert the cancel so
    // no partial refund is left behind.
    const { error: deleteErr } = await supabaseServer
      .from('tokens')
      .delete()
      .eq('id', token.id);

    if (deleteErr) {
      console.error('Refund: token delete failed, reverting cancel:', deleteErr);
      const { error: revertErr } = await supabaseServer
        .from('transactions')
        .update({ cancelled_at: null } as never)
        .eq('id', transaction.id);
      if (revertErr) {
        console.error('Refund: revert of cancel failed:', revertErr);
      }
      return Response.json(
        {
          error: 'Refund failed; no changes were made.',
          code: ERROR_CODES.TRANSACTION_FAILED,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    // 3. Renumber the remaining active tickets in the group. The refund is
    // already committed, so a resequence failure must not fail the request.
    try {
      await resequenceGroupTransactions(
        supabaseServer as never,
        transaction.transaction_group_id
      );
    } catch (seqErr) {
      console.error('Refund: resequence failed (non-fatal):', seqErr);
    }

    // 4. Audit log — best-effort, never fails the committed refund.
    try {
      await supabaseServer.from('audit_log').insert({
        user_id: admin.id,
        action: 'REFUND',
        entity_type: 'transaction',
        entity_id: transaction.id,
        metadata: {
          token_number: token.token_number,
          token_index: token.token_index,
          token_total: token.token_total,
          txn_reference: transaction.txn_reference,
          amount: transaction.amount,
          price_type: transaction.price_type,
          activity_id: transaction.activity_id,
          cashier_id: transaction.cashier_id,
          refund_reason: validation.data.reason || null,
          refunded_at: refundedAt,
        },
        created_at: new Date().toISOString(),
      } as never);
    } catch (auditErr) {
      console.error('Refund: audit_log insert failed (non-fatal):', auditErr);
    }

    return Response.json(
      {
        data: {
          success: true,
          token_number: token.token_number,
          transaction_id: transaction.id,
          amount: transaction.amount,
          refunded_at: refundedAt,
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
