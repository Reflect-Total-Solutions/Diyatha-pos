import { ERROR_CODES, HTTP_STATUS } from '@/lib/constants';
import { toAppUser } from '@/lib/authUser';
import { createSupabaseServerClient, supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const [userResult, sessionResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (userResult.error || !userResult.data.user) {
    return Response.json(
      {
        error: 'Unauthorized',
        code: ERROR_CODES.UNAUTHORIZED,
      },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  const { data: profile } = await supabaseServer
    .from('users')
    .select('*')
    .eq('id', userResult.data.user.id)
    .maybeSingle();

  const appUser = toAppUser(userResult.data.user, profile ?? null);

  return Response.json(
    {
      data: {
        user: appUser,
        session: sessionResult.data.session
          ? {
              access_token: sessionResult.data.session.access_token,
              expires_at: sessionResult.data.session.expires_at ?? 0,
            }
          : null,
      },
    },
    { status: HTTP_STATUS.OK }
  );
}
