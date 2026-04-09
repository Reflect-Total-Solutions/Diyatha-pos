import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { UpdateUserSchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `admin:users:get:${admin.id}`,
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
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const userRecord = data as UserRow | null;

    if (!userRecord) {
      return Response.json(
        {
          error: 'User not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return Response.json(
      {
        data: userRecord,
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
    const admin = await requireAdminRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `admin:users:update:${admin.id}`,
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
    const validation = validateInput(UpdateUserSchema, payload);

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

    const updatePayload: UserUpdate = {};
    const authUpdatePayload: {
      email?: string;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (validation.data.email !== undefined) {
      const normalizedEmail = normalizeEmail(validation.data.email);
      updatePayload.email = normalizedEmail;
      authUpdatePayload.email = normalizedEmail;
    }

    if (validation.data.display_name !== undefined) {
      const displayName = validation.data.display_name.trim();
      updatePayload.display_name = displayName;
      authUpdatePayload.user_metadata = {
        ...(authUpdatePayload.user_metadata ?? {}),
        display_name: displayName,
      };
    }

    if (validation.data.phone !== undefined) {
      const phone = validation.data.phone.trim() || null;
      updatePayload.phone = phone;
      authUpdatePayload.user_metadata = {
        ...(authUpdatePayload.user_metadata ?? {}),
        phone,
      };
    }

    if (validation.data.role !== undefined) {
      updatePayload.role = validation.data.role;
      authUpdatePayload.app_metadata = {
        ...(authUpdatePayload.app_metadata ?? {}),
        role: validation.data.role,
      };
    }

    if (validation.data.is_active !== undefined) {
      updatePayload.is_active = validation.data.is_active;
      authUpdatePayload.user_metadata = {
        ...(authUpdatePayload.user_metadata ?? {}),
        is_active: validation.data.is_active,
      };
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

    if (validation.data.role === 'cashier' && admin.id === id) {
      return Response.json(
        {
          error: 'You cannot remove your own admin role',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    if (Object.keys(authUpdatePayload).length > 0) {
      const authUpdateResult = await supabaseServer.auth.admin.updateUserById(
        id,
        authUpdatePayload
      );

      if (authUpdateResult.error) {
        return Response.json(
          {
            error: authUpdateResult.error.message,
            code: ERROR_CODES.DATABASE_ERROR,
          },
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }
    }

    const { data, error } = await supabaseServer
      .from('users')
      .update(updatePayload as never)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
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

    const updatedUser = data as UserRow | null;

    if (!updatedUser) {
      return Response.json(
        {
          error: 'User not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: admin.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: updatedUser.id,
        metadata: {
          updated_fields: Object.keys(updatePayload),
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: updatedUser,
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
    const admin = await requireAdminRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `admin:users:delete:${admin.id}`,
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

    if (admin.id === id) {
      return Response.json(
        {
          error: 'You cannot delete your own account',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    const { data: existingUser, error: existingUserError } = await supabaseServer
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    const existingUserRecord = existingUser as { id: string; email: string } | null;

    if (!existingUserRecord) {
      return Response.json(
        {
          error: 'User not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const deleteResult = await supabaseServer.auth.admin.deleteUser(id);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    await supabaseServer.from('audit_log').insert(
      {
        user_id: admin.id,
        action: 'DELETE',
        entity_type: 'user',
        entity_id: id,
        metadata: {
          email: existingUserRecord.email,
        },
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
