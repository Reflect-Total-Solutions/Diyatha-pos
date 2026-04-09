import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { ActivitySchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type ActivityInsert = Database['public']['Tables']['activities']['Insert'];

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
    categoryId: searchParams.get('category_id') ?? undefined,
    includeInactive: searchParams.get('include_inactive') === 'true',
  };
}

async function ensureCategoryExists(categoryId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();

    const allowed = rateLimit(
      `activities:list:${user.id}`,
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

    const { page, limit, categoryId, includeInactive } = parsePagination(request.url);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    let query = supabaseServer
      .from('activities')
      .select('*', { count: 'exact' })
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (!isAdmin || !includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const activities = (data ?? []) as unknown as ActivityRow[];
    const total = count ?? activities.length;

    return Response.json(
      {
        data: activities,
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

    const allowed = rateLimit(
      `activities:create:${user.id}`,
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

    if (user.role !== 'admin') {
      return Response.json(
        {
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const payload = await request.json().catch(() => null);
    const validation = validateInput(ActivitySchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid activity payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    if (validation.data.category_id) {
      const categoryExists = await ensureCategoryExists(validation.data.category_id);

      if (!categoryExists) {
        return Response.json(
          {
            error: 'Category not found',
            code: ERROR_CODES.NOT_FOUND,
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
    }

    const insertPayload: ActivityInsert = {
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || null,
      category_id: validation.data.category_id ?? null,
      image_url: validation.data.image_url?.trim() || null,
      local_price: validation.data.local_price,
      foreign_price: validation.data.foreign_price,
      is_active: validation.data.is_active ?? true,
      display_order: validation.data.display_order ?? 0,
    };

    const { data, error } = await supabaseServer
      .from('activities')
      .insert(insertPayload as never)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const activityRecord = data as unknown as ActivityRow | null;

    if (!activityRecord) {
      return Response.json(
        {
          error: 'Failed to create activity',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'activity',
        entity_id: activityRecord.id,
        metadata: {
          name: activityRecord.name,
          category_id: activityRecord.category_id,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: activityRecord,
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
