import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { UserRole } from '@/types/user';

export type RequestUserContext = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
};

export async function requireRequestUser(): Promise<RequestUserContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('Unauthorized');
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const userProfileRecord = (userProfile ?? null) as Record<string, unknown> | null;

  return {
    id: user.id,
    email: user.email ?? '',
    role:
      (userProfileRecord?.role as UserRole | undefined) ??
      ((user.app_metadata?.role as UserRole | undefined) ?? 'cashier'),
    displayName:
      (userProfileRecord?.display_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Cashier',
  };
}

export async function requireAdminRequestUser(): Promise<RequestUserContext> {
  const user = await requireRequestUser();

  if (user.role !== 'admin') {
    throw new ForbiddenError('Forbidden');
  }

  return user;
}
