import { z } from 'zod';

import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { CreateTransactionGroupSchema, validateInput } from '@/lib/schemas';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getTransactionGroupStats } from '@/lib/transactions';
import type { Database } from '@/types/database';

type TransactionGroupRow = Database['public']['Tables']['transaction_groups']['Row'];
type TransactionGroupInsert = Database['public']['Tables']['transaction_groups']['Insert'];
type TransactionGroupUpdate = Database['public']['Tables']['transaction_groups']['Update'];

const FinalizeTransactionGroupSchema = z.object({
  group_id: z.string().uuid('Invalid transaction group ID'),
});

function parsePagination(url: string) {
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
    activeOnly: searchParams.get('active_only') !== 'false',
    cashierId: searchParams.get('cashier_id') ?? undefined,
  };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transaction-groups:list:${user.id}`,
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

    const { page, limit, activeOnly, cashierId } = parsePagination(request.url);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transaction_groups')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activeOnly) {
      query = query.is('completed_at', null);
    }

    if (user.role === 'cashier') {
      query = query.eq('cashier_id', user.id);
    } else if (cashierId) {
      query = query.eq('cashier_id', cashierId);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const groups = (data ?? []) as unknown as TransactionGroupRow[];
    const statsMap = await getTransactionGroupStats(
      supabase,
      groups.map((group) => group.id)
    );

    const rows = groups.map((group) => {
      const stats = statsMap.get(group.id) ?? {
        transaction_count: 0,
        total_amount: 0,
      };

      return {
        ...group,
        transaction_count: stats.transaction_count,
        total_amount: stats.total_amount,
      };
    });

    const total = count ?? rows.length;

    return Response.json(
      {
        data: rows,
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
      `transaction-groups:create:${user.id}`,
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

    const payload = await request.json().catch(() => ({}));
    const validation = validateInput(CreateTransactionGroupSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid transaction group payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const insertPayload: TransactionGroupInsert = {
      cashier_id: user.id,
      notes: validation.data.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from('transaction_groups')
      .insert(insertPayload as never)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const groupRecord = data as unknown as TransactionGroupRow | null;

    if (!groupRecord) {
      return Response.json(
        {
          error: 'Failed to create transaction group',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    await supabase.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'START_GROUP',
        entity_type: 'transaction_group',
        entity_id: groupRecord.id,
        metadata: {
          notes: groupRecord.notes,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: {
          ...groupRecord,
          transaction_count: 0,
          total_amount: 0,
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

export async function PATCH(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transaction-groups:update:${user.id}`,
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
    const validation = validateInput(FinalizeTransactionGroupSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid transaction group update payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { data: groupData, error: groupError } = await supabase
      .from('transaction_groups')
      .select('*')
      .eq('id', validation.data.group_id)
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

    if (user.role !== 'admin' && groupRecord.cashier_id !== user.id) {
      return Response.json(
        {
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const updatePayload: TransactionGroupUpdate = {
      completed_at: groupRecord.completed_at ?? new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('transaction_groups')
      .update(updatePayload as never)
      .eq('id', groupRecord.id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const updatedGroup = data as unknown as TransactionGroupRow | null;

    if (!updatedGroup) {
      return Response.json(
        {
          error: 'Transaction group not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const statsMap = await getTransactionGroupStats(supabase, [updatedGroup.id]);
    const stats = statsMap.get(updatedGroup.id) ?? {
      transaction_count: 0,
      total_amount: 0,
    };

    await supabase.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'END_GROUP',
        entity_type: 'transaction_group',
        entity_id: updatedGroup.id,
        metadata: {
          completed_at: updatedGroup.completed_at,
          transaction_count: stats.transaction_count,
          total_amount: stats.total_amount,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: {
          ...updatedGroup,
          transaction_count: stats.transaction_count,
          total_amount: stats.total_amount,
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
