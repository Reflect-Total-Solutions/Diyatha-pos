import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import type { User as AppUser } from '@/types/user';

type UserRow = Database['public']['Tables']['users']['Row'];

export function toAppUser(
  authUser: SupabaseAuthUser,
  profile?: UserRow | null
): AppUser {
  const displayNameFallback = authUser.email?.split('@')[0] ?? 'Cashier';

  return {
    id: authUser.id,
    email: authUser.email ?? profile?.email ?? '',
    role: profile?.role ?? 'cashier',
    display_name: profile?.display_name ?? displayNameFallback,
    phone: profile?.phone ?? null,
    is_active: profile?.is_active ?? true,
    failed_login_attempts: profile?.failed_login_attempts ?? 0,
    locked_until: profile?.locked_until ?? null,
    created_at: profile?.created_at ?? new Date().toISOString(),
    updated_at: profile?.updated_at ?? new Date().toISOString(),
  };
}
