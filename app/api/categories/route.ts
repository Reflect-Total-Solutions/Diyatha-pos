import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { CategorySchema, validateInput } from '@/lib/schemas';
import { createSupabaseServerClient, supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

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
    includeInactive: searchParams.get('include_inactive') === 'true',
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `categories:list:${user.id}`,
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

    const { page, limit, includeInactive } = parsePagination(request.url);
    const offset = (page - 1) * limit;
    const isAdmin = user.role === 'admin';

    const client = isAdmin ? supabaseServer : supabase;

    let query = client
      .from('categories')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (!isAdmin || !includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const categories = (data ?? []) as unknown as CategoryRow[];
    const total = count ?? categories.length;

    return Response.json(
      {
        data: categories,
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
      `categories:create:${user.id}`,
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
    const validation = validateInput(CategorySchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid category payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const insertPayload: CategoryInsert = {
      name: validation.data.name.trim(),
      description: validation.data.description?.trim() || null,
      is_active: validation.data.is_active ?? true,
    };

    const { data, error } = await supabaseServer
      .from('categories')
      .insert(insertPayload as never)
      .select('*')
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return Response.json(
          {
            error: 'Category with this name already exists',
            code: ERROR_CODES.RESOURCE_CONFLICT,
          },
          { status: HTTP_STATUS.CONFLICT }
        );
      }

      throw error;
    }

    const categoryRecord = data as unknown as CategoryRow | null;

    if (!categoryRecord) {
      return Response.json(
        {
          error: 'Failed to create category',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'category',
        entity_id: categoryRecord.id,
        metadata: {
          name: categoryRecord.name,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: categoryRecord,
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
