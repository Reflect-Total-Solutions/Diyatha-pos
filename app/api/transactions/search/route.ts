import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

type TransactionTokenRow = {
  transaction_id: string;
  token_number: string;
};

function parseSearchParams(url: string) {
  const searchParams = new URL(url).searchParams;

  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '20', 10);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, limitParam))
    : 20;

  return {
    page,
    limit,
    query: searchParams.get('q')?.trim() ?? '',
    token: searchParams.get('token')?.trim() ?? '',
    activityId: searchParams.get('activityId') ?? undefined,
    cashierId: searchParams.get('cashierId') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    includeCancelled: searchParams.get('include_cancelled') === 'true',
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transactions:search:${user.id}`,
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

    const params = parseSearchParams(request.url);
    const offset = (params.page - 1) * params.limit;

    const isAdmin = user.role === 'admin';
    const cashierFilter = !isAdmin ? user.id : params.cashierId || null;
    const keyword = params.query || params.token || null;

    // Fast path: Try single-query database-level search RPC with GIN trigram indexes
    type SearchRpcRow = TransactionRow & {
      token_number: string | null;
      full_count: number;
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'search_transactions_v2' as never,
      {
        p_query: keyword,
        p_cashier_id: cashierFilter,
        p_activity_id: params.activityId || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_include_cancelled: params.includeCancelled,
        p_limit: params.limit,
        p_offset: offset,
      } as never
    );

    const rpcRows = (rpcData as unknown as SearchRpcRow[] | null) ?? null;

    if (!rpcError && rpcRows) {
      const total = rpcRows.length > 0 ? Number(rpcRows[0].full_count) : 0;
      const data = rpcRows.map((row) => {
        const cleanRow: Partial<SearchRpcRow> = { ...row };
        delete cleanRow.full_count;
        return cleanRow as TransactionRow & { token_number: string | null };
      });

      return Response.json(
        {
          data,
          total,
          page: params.page,
          limit: params.limit,
          totalPages: Math.ceil(total / params.limit),
        },
        { status: HTTP_STATUS.OK }
      );
    }

    // Fallback path if RPC is not yet created in the database:
    let rows: TransactionRow[] = [];
    let total = 0;

    if (keyword) {
      let refQuery = supabase
        .from('transactions')
        .select('*')
        .ilike('txn_reference', `%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(params.limit * 5);

      if (!isAdmin) {
        refQuery = refQuery.eq('cashier_id', user.id);
      } else if (params.cashierId) {
        refQuery = refQuery.eq('cashier_id', params.cashierId);
      }

      if (params.activityId) {
        refQuery = refQuery.eq('activity_id', params.activityId);
      }

      if (params.startDate) {
        refQuery = refQuery.gte('created_at', params.startDate);
      }

      if (params.endDate) {
        refQuery = refQuery.lte('created_at', params.endDate);
      }

      if (!params.includeCancelled) {
        refQuery = refQuery.is('cancelled_at', null);
      }

      const { data: referenceRows, error: referenceError } = await refQuery;

      if (referenceError) {
        throw referenceError;
      }

      const { data: tokenMatchRows, error: tokenMatchError } = await supabase
        .from('tokens')
        .select('transaction_id, token_number')
        .ilike('token_number', `%${keyword}%`)
        .limit(1000);

      if (tokenMatchError) {
        throw tokenMatchError;
      }

      const tokenMatches = (tokenMatchRows ?? []) as TransactionTokenRow[];
      const tokenTransactionIds = Array.from(new Set(tokenMatches.map((row) => row.transaction_id)));

      let tokenRows: TransactionRow[] = [];

      if (tokenTransactionIds.length > 0) {
        let tokenQuery = supabase
          .from('transactions')
          .select('*')
          .in('id', tokenTransactionIds)
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          tokenQuery = tokenQuery.eq('cashier_id', user.id);
        } else if (params.cashierId) {
          tokenQuery = tokenQuery.eq('cashier_id', params.cashierId);
        }

        if (params.activityId) {
          tokenQuery = tokenQuery.eq('activity_id', params.activityId);
        }

        if (params.startDate) {
          tokenQuery = tokenQuery.gte('created_at', params.startDate);
        }

        if (params.endDate) {
          tokenQuery = tokenQuery.lte('created_at', params.endDate);
        }

        if (!params.includeCancelled) {
          tokenQuery = tokenQuery.is('cancelled_at', null);
        }

        const { data: tokenTransactionRows, error: tokenTransactionError } = await tokenQuery;

        if (tokenTransactionError) {
          throw tokenTransactionError;
        }

        tokenRows = (tokenTransactionRows ?? []) as unknown as TransactionRow[];
      }

      const mergedById = new Map<string, TransactionRow>();

      for (const row of (referenceRows ?? []) as unknown as TransactionRow[]) {
        mergedById.set(row.id, row);
      }

      for (const row of tokenRows) {
        mergedById.set(row.id, row);
      }

      const merged = Array.from(mergedById.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      total = merged.length;
      rows = merged.slice(offset, offset + params.limit);
    } else {
      let baseQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + params.limit - 1);

      if (!isAdmin) {
        baseQuery = baseQuery.eq('cashier_id', user.id);
      } else if (params.cashierId) {
        baseQuery = baseQuery.eq('cashier_id', params.cashierId);
      }

      if (params.activityId) {
        baseQuery = baseQuery.eq('activity_id', params.activityId);
      }

      if (params.startDate) {
        baseQuery = baseQuery.gte('created_at', params.startDate);
      }

      if (params.endDate) {
        baseQuery = baseQuery.lte('created_at', params.endDate);
      }

      if (!params.includeCancelled) {
        baseQuery = baseQuery.is('cancelled_at', null);
      }

      const { data, error, count } = await baseQuery;

      if (error) {
        throw error;
      }

      rows = (data ?? []) as unknown as TransactionRow[];
      total = count ?? rows.length;
    }

    const transactionIds = rows.map((row) => row.id);
    let tokenMap = new Map<string, TransactionTokenRow>();

    if (transactionIds.length > 0) {
      const { data: tokenRows, error: tokenError } = await supabase
        .from('tokens')
        .select('transaction_id, token_number')
        .in('transaction_id', transactionIds);

      if (tokenError) {
        throw tokenError;
      }

      tokenMap = new Map(
        ((tokenRows ?? []) as TransactionTokenRow[]).map((row) => [row.transaction_id, row])
      );
    }

    const data = rows.map((row) => ({
      ...row,
      token_number: tokenMap.get(row.id)?.token_number ?? null,
    }));

    return Response.json(
      {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
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
