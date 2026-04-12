import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { TransactionSchema, validateInput } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { resequenceGroupTransactions } from '@/lib/transactions';
import { getColomboDates } from '@/lib/dateUtils';
import type { Database } from '@/types/database';

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type TransactionGroupRow = Database['public']['Tables']['transaction_groups']['Row'];
type TokenInsert = Database['public']['Tables']['tokens']['Insert'];

function parsePagination(url: string) {
  const searchParams = new URL(url).searchParams;
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '20', 10);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam)
    ? Math.min(10000, Math.max(1, limitParam))
    : 20;

  return {
    page,
    limit,
    includeCancelled: searchParams.get('include_cancelled') === 'true',
    transactionGroupId: searchParams.get('transaction_group_id') ?? undefined,
    cashierId: searchParams.get('cashier_id') ?? undefined,
    startDate: searchParams.get('start_date') ?? undefined,
    endDate: searchParams.get('end_date') ?? undefined,
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transactions:list:${user.id}`,
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

    const { page, limit, includeCancelled, transactionGroupId, cashierId, startDate, endDate } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*, tokens!inner(token_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user.role === 'cashier') {
      query = query.eq('cashier_id', user.id);
    } else if (cashierId) {
      query = query.eq('cashier_id', cashierId);
    }

    if (transactionGroupId) {
      query = query.eq('transaction_group_id', transactionGroupId);
    }

    if (!includeCancelled) {
      query = query.is('cancelled_at', null);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lt('created_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as any[];
    
    // Map tokens back to token_number for the client
    const formattedRows = rows.map(row => {
      const tokensArray = Array.isArray(row.tokens) ? row.tokens : [row.tokens];
      const tokenObj = tokensArray[0] as { token_number?: string } | undefined;
      
      return {
        ...row,
        token_number: tokenObj?.token_number ?? null,
      };
    });
    
    const total = count ?? formattedRows.length;

    return Response.json(
      {
        data: formattedRows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transactions:create:${user.id}`,
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
    const validation = validateInput(TransactionSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid transaction payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { data: groupData, error: groupError } = await supabase
      .from('transaction_groups')
      .select('*')
      .eq('id', validation.data.transaction_group_id)
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

    const { data: activityData, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', validation.data.activity_id)
      .maybeSingle();

    if (activityError) {
      throw activityError;
    }

    const activityRecord = activityData as unknown as ActivityRow | null;

    if (!activityRecord || !activityRecord.is_active) {
      return Response.json(
        {
          error: 'Activity not found or inactive',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const amount =
      validation.data.price_type === 'local'
        ? activityRecord.local_price
        : activityRecord.foreign_price;

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
      transaction_group_id: groupRecord.id,
      cashier_id: groupRecord.cashier_id,
      activity_id: activityRecord.id,
      price_type: validation.data.price_type,
      amount,
      txn_reference: txnReference,
      print_status: 'pending',
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(insertPayload as never)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const transactionRecord = data as unknown as TransactionRow | null;

    if (!transactionRecord) {
      return Response.json(
        {
          error: 'Failed to create transaction',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    const sequenced = await resequenceGroupTransactions(supabase, groupRecord.id);
    const tokenIndex =
      sequenced.transactions.findIndex((row) => row.id === transactionRecord.id) + 1;
    const tokenTotal = sequenced.total;

    if (tokenIndex <= 0) {
      return Response.json(
        {
          error: 'Failed to resolve token position',
          code: ERROR_CODES.TRANSACTION_FAILED,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

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

    const { utcNow } = getColomboDates();

    const tokenPayload: TokenInsert = {
      transaction_id: transactionRecord.id,
      token_number: generatedToken,
      token_index: tokenIndex,
      token_total: tokenTotal,
      printed_at: utcNow.toISOString(),
    };

    await supabase.from('tokens').insert(tokenPayload as never);

    await supabase.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'transaction',
        entity_id: transactionRecord.id,
        metadata: {
          transaction_group_id: groupRecord.id,
          activity_id: activityRecord.id,
          amount,
          token_number: generatedToken,
          token_index: tokenIndex,
          token_total: tokenTotal,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: {
          ...transactionRecord,
          amount,
          token_index: tokenIndex,
          token_total: tokenTotal,
          token_number: generatedToken,
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
