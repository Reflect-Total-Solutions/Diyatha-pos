import type { User } from '@supabase/supabase-js';

import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createSupabaseServerClient, supabaseServer } from '@/lib/supabase-server';
import type { UserRole } from '@/types/user';

const AUTH_COOKIE_NAMES = [
  'pc_access_token',
  'access_token',
  'sb-access-token',
  'sb:token',
] as const;

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return acc;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');

  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const parsedCookies = parseCookies(request.headers.get('cookie'));
  for (const cookieName of AUTH_COOKIE_NAMES) {
    const value = parsedCookies[cookieName];
    if (value) return value;
  }

  return null;
}

function roleFromClaims(user: User): UserRole | null {
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  const candidate = appRole ?? userRole;

  if (candidate === 'admin' || candidate === 'cashier') {
    return candidate;
  }

  return null;
}

async function resolveUserRole(user: User): Promise<UserRole | null> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const userRoleRecord = data as unknown as { role: UserRole } | null;

  if (
    !error &&
    (userRoleRecord?.role === 'admin' || userRoleRecord?.role === 'cashier')
  ) {
    return userRoleRecord.role;
  }

  return roleFromClaims(user);
}

export async function requireAuth(request: Request): Promise<User> {
  const token = extractBearerToken(request);

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  const { data, error } = await supabaseServer.auth.getUser(token);

  if (error || !data.user) {
    throw new UnauthorizedError('Invalid or expired session token');
  }

  return data.user;
}

export async function requireAdminAuth(request: Request): Promise<User> {
  const user = await requireAuth(request);
  const role = await resolveUserRole(user);

  if (role !== 'admin') {
    throw new ForbiddenError('Admin privileges required');
  }

  return user;
}

export async function getServerSessionUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
