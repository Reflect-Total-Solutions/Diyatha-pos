import { LoginSchema, validateInput } from '@/lib/schemas';
import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { createSupabaseServerClient, supabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rateLimit';
import { toAppUser } from '@/lib/authUser';

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  const allowed = rateLimit(
    `auth:login:${getClientIp(request)}`,
    RATE_LIMITS.LOGIN.attempts,
    RATE_LIMITS.LOGIN.windowMs
  );

  if (!allowed) {
    return Response.json(
      {
        error: 'Too many login attempts. Please try again later.',
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      },
      { status: HTTP_STATUS.RATE_LIMITED }
    );
  }

  const payload = await request.json().catch(() => null);
  const validation = validateInput(LoginSchema, payload);

  if (!validation.valid) {
    return Response.json(
      {
        error: 'Invalid login payload',
        code: ERROR_CODES.VALIDATION_ERROR,
        details: validation.errors,
      },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(validation.data);

  if (error || !data.user) {
    return Response.json(
      {
        error: 'Invalid email or password',
        code: ERROR_CODES.INVALID_CREDENTIALS,
      },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  const { data: profile } = await supabaseServer
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profile && (profile as any).is_active === false) {
    await supabase.auth.signOut();
    return Response.json(
      {
        error: 'Your account is deactivated. Please contact an administrator.',
        code: ERROR_CODES.ACCOUNT_LOCKED,
      },
      { status: HTTP_STATUS.FORBIDDEN }
    );
  }

  const appUser = toAppUser(data.user, profile ?? null);

  return Response.json(
    {
      data: {
        user: appUser,
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at ?? 0,
            }
          : null,
      },
    },
    { status: HTTP_STATUS.OK }
  );
}
