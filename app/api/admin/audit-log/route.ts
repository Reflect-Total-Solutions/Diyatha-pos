import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database, Json } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuditRow = Database['public']['Tables']['audit_log']['Row'];

function parseFilters(url: string) {
  const searchParams = new URL(url).searchParams;
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '50', 10);

  return {
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    limit: Number.isFinite(limitParam)
      ? Math.min(200, Math.max(1, limitParam))
      : 50,
    action: searchParams.get('action')?.trim() || undefined,
    entityType: searchParams.get('entity_type')?.trim() || undefined,
    userId: searchParams.get('user_id')?.trim() || undefined,
    from: searchParams.get('from')?.trim() || undefined,
    to: searchParams.get('to')?.trim() || undefined,
  };
}

function jsonAsRecord(value: Json | null): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:audit:list:${admin.id}`,
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

    const filters = parseFilters(request.url);
    const offset = (filters.page - 1) * filters.limit;

    let query = supabaseServer
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + filters.limit - 1);

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.from) {
      query = query.gte('created_at', `${filters.from}T00:00:00.000Z`);
    }

    if (filters.to) {
      query = query.lte('created_at', `${filters.to}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as AuditRow[];
    const userIds = Array.from(
      new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
    );

    const userNames = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseServer
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);

      if (usersError) {
        throw usersError;
      }

      for (const user of (users ?? []) as Array<{ id: string; display_name: string; email: string }>) {
        userNames.set(user.id, user.display_name || user.email);
      }
    }

    const formatted = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_id ? userNames.get(row.user_id) ?? row.user_id : 'System',
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: jsonAsRecord(row.metadata),
      created_at: row.created_at,
    }));

    const total = count ?? formatted.length;

    return Response.json(
      {
        data: formatted,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
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
