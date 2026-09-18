import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing URL or SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const tables = [
    'users',
    'categories',
    'activities',
    'transaction_groups',
    'transactions',
    'tokens',
    'audit_log',
    'error_logs',
    'printer_status_cache',
  ];

  console.log('\n--- SUPABASE TABLE STATUS ---');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${t.padEnd(22)}: NOT FOUND / ERROR (${error.message})`);
    } else {
      console.log(`✅ ${t.padEnd(22)}: EXISTS (Rows: ${count ?? 0})`);
    }
  }

  const { count: viewCount, error: viewError } = await supabase
    .from('daily_summary')
    .select('*', { count: 'exact', head: true });
  if (viewError) {
    console.log(`❌ ${'daily_summary (view)'.padEnd(22)}: NOT FOUND (${viewError.message})`);
  } else {
    console.log(`✅ ${'daily_summary (view)'.padEnd(22)}: EXISTS (Rows: ${viewCount ?? 0})`);
  }

  // Check admin user in auth.users
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log('\n--- AUTH USERS ---');
  for (const u of authUsers?.users ?? []) {
    console.log(`👤 ${u.email} (ID: ${u.id}, Role: ${u.app_metadata?.role ?? 'none'})`);
  }

  // Check RPC functions
  console.log('\n--- FUNCTIONS & PROCEDURES ---');
  const { data: searchData, error: searchError } = await supabase.rpc('search_transactions_v2' as never, {
    p_query: '',
    p_limit: 5,
  } as never);

  if (searchError) {
    console.log(`⚠️ search_transactions_v2: NOT INSTALLED YET (${searchError.message})`);
    console.log('   (Run supabase/migrations/024_optimize_database_performance.sql in Supabase SQL Editor)');
  } else {
    console.log(`✅ search_transactions_v2: INSTALLED AND WORKING!`);
  }

  const { data: adminData, error: adminError } = await supabase.rpc('is_admin' as never);
  if (adminError) {
    console.log(`⚠️ is_admin(): NOT INSTALLED YET (${adminError.message})`);
    console.log('   (Run supabase/migrations/025_fix_rls_admin_policies.sql in Supabase SQL Editor)');
  } else {
    console.log(`✅ is_admin(): INSTALLED AND WORKING!`);
  }
  console.log('\n');
}

run();
