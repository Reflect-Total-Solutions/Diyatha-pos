import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { UpdateActivitySchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ActivityRow = Database['public']['Tables']['activities']['Row'];
type ActivityUpdate = Database['public']['Tables']['activities']['Update'];

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `activities:get:${user.id}`,
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
      .from('activities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const activityRecord = data as unknown as ActivityRow | null;

    if (!activityRecord || (!activityRecord.is_active && user.role !== 'admin')) {
      return Response.json(
        {
          error: 'Activity not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return Response.json(
      {
        data: activityRecord,
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
      `activities:update:${user.id}`,
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
    const validation = validateInput(UpdateActivitySchema, payload);

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

    const updatePayload: ActivityUpdate = {};

    if (validation.data.name !== undefined) {
      updatePayload.name = validation.data.name.trim();
    }

    if (validation.data.description !== undefined) {
      updatePayload.description = validation.data.description.trim() || null;
    }

    if (validation.data.category_id !== undefined) {
      updatePayload.category_id = validation.data.category_id;
    }

    if (validation.data.vendor_id !== undefined) {
      updatePayload.vendor_id = validation.data.vendor_id;
    }

    if (validation.data.local_price !== undefined) {
      updatePayload.local_price = validation.data.local_price;
    }

    if (validation.data.foreign_price !== undefined) {
      updatePayload.foreign_price = validation.data.foreign_price;
    }

    if (validation.data.image_url !== undefined) {
      updatePayload.image_url = validation.data.image_url?.trim() || null;
    }

    if (validation.data.is_active !== undefined) {
      updatePayload.is_active = validation.data.is_active;
    }

    if (validation.data.display_order !== undefined) {
      updatePayload.display_order = validation.data.display_order;
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
      .from('activities')
      .update(updatePayload as never)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const activityRecord = data as unknown as ActivityRow | null;

    if (!activityRecord) {
      return Response.json(
        {
          error: 'Activity not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'activity',
        entity_id: activityRecord.id,
        metadata: {
          updated_fields: Object.keys(updatePayload),
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: activityRecord,
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
      `activities:delete:${user.id}`,
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
      .from('activities')
      .update({ deleted_at: new Date().toISOString() } as never)
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
          error: 'Activity not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'DELETE',
        entity_type: 'activity',
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
