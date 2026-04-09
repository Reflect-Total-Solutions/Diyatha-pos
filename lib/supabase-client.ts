import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return { url, anonKey };
}

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseBrowserClient must be called in the browser');
  }

  if (!browserClient) {
    const { url, anonKey } = getPublicSupabaseConfig();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
}
