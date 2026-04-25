import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { CreateUserSchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];

function parseListFilters(url: string) {
  const searchParams = new URL(url).searchParams;
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '20', 10);
  const roleParam = searchParams.get('role');
  const isActiveParam = searchParams.get('is_active');

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, limitParam))
    : 20;

  return {
    page,
    limit,
    query: searchParams.get('q')?.trim() || undefined,
    role:
      roleParam === 'admin' || roleParam === 'cashier' || roleParam === 'vendor'
        ? roleParam
        : undefined,
    isActive:
      isActiveParam === 'true'
        ? true
        : isActiveParam === 'false'
          ? false
          : undefined,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:users:list:${admin.id}`,
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

    const filters = parseListFilters(request.url);
    const offset = (filters.page - 1) * filters.limit;

    let query = supabaseServer
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + filters.limit - 1);

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.query) {
      const escaped = filters.query.replace(/[%_]/g, (char) => `\\${char}`);
      query = query.or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const users = (data ?? []) as UserRow[];
    const total = count ?? users.length;

    return Response.json(
      {
        data: users,
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

export async function POST(request: Request) {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:users:create:${admin.id}`,
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
    const validation = validateInput(CreateUserSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid user payload',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const email = normalizeEmail(validation.data.email);
    const displayName = validation.data.display_name.trim();
    const phone = validation.data.phone?.trim() || null;

    const authCreateResult = await supabaseServer.auth.admin.createUser({
      email,
      password: validation.data.password,
      email_confirm: true,
      app_metadata: {
        role: validation.data.role,
      },
      user_metadata: {
        display_name: displayName,
        phone,
      },
    });

    if (authCreateResult.error || !authCreateResult.data.user) {
      return Response.json(
        {
          error: authCreateResult.error?.message ?? 'Failed to create auth user',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const authUser = authCreateResult.data.user;

    const insertPayload: UserInsert = {
      id: authUser.id,
      email,
      role: validation.data.role,
      display_name: displayName,
      phone,
      is_active: validation.data.is_active ?? true,
    };

    const { data, error } = await supabaseServer
      .from('users')
      .insert(insertPayload as never)
      .select('*')
      .maybeSingle();

    if (error) {
      await supabaseServer.auth.admin.deleteUser(authUser.id);

      if ((error as { code?: string }).code === '23505') {
        return Response.json(
          {
            error: 'User with this email already exists',
            code: ERROR_CODES.RESOURCE_CONFLICT,
          },
          { status: HTTP_STATUS.CONFLICT }
        );
      }

      throw error;
    }

    const createdUser = data as UserRow | null;

    if (!createdUser) {
      return Response.json(
        {
          error: 'Failed to create user profile',
          code: ERROR_CODES.DATABASE_ERROR,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: admin.id,
        action: 'CREATE',
        entity_type: 'user',
        entity_id: createdUser.id,
        metadata: {
          email: createdUser.email,
          role: createdUser.role,
          is_active: createdUser.is_active,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: createdUser,
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
