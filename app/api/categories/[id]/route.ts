import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { UpdateCategorySchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CategoryRow = Database['public']['Tables']['categories']['Row'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `categories:get:${user.id}`,
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

    const { data, error } = await supabaseServer
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const categoryRecord = data as unknown as CategoryRow | null;

    if (!categoryRecord || (!categoryRecord.is_active && user.role !== 'admin')) {
      return Response.json(
        {
          error: 'Category not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return Response.json(
      {
        data: categoryRecord,
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `categories:update:${user.id}`,
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
    const validation = validateInput(UpdateCategorySchema, payload);

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

    const updatePayload: CategoryUpdate = {};

    if (validation.data.name !== undefined) {
      updatePayload.name = validation.data.name.trim();
    }

    if (validation.data.description !== undefined) {
      updatePayload.description = validation.data.description.trim() || null;
    }

    if (validation.data.is_active !== undefined) {
      updatePayload.is_active = validation.data.is_active;
    }

    if (Object.keys(updatePayload).length === 0) {
      return Response.json(
        {
          error: 'No fields provided for update',
          code: ERROR_CODES.VALIDATION_ERROR,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { data, error } = await supabaseServer
      .from('categories')
      .update(updatePayload as never)
      .eq('id', id)
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
          error: 'Category not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'category',
        entity_id: categoryRecord.id,
        metadata: {
          updated_fields: Object.keys(updatePayload),
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: categoryRecord,
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `categories:delete:${user.id}`,
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

    const { data, error } = await supabaseServer
      .from('categories')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const deletedRecord = data as unknown as { id: string } | null;

    if (!deletedRecord) {
      return Response.json(
        {
          error: 'Category not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'category',
        entity_id: deletedRecord.id,
        metadata: {},
        created_at: new Date().toISOString(),
      } as never
    );

    return new Response(null, { status: 204 });
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
