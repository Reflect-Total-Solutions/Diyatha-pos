import { ERROR_CODES, HTTP_STATUS } from '@/lib/constants';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return Response.json(
      {
        error: 'Unable to sign out',
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      },
      { status: HTTP_STATUS.SERVER_ERROR }
    );
  }

  return Response.json(
    {
      data: {
        success: true,
      },
    },
    { status: HTTP_STATUS.OK }
  );
}
