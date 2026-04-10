import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { getColomboEndOfDay, getColomboStartOfDay } from '@/lib/dateUtils';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET() {
  try {
    const admin = await requireAdminRequestUser();

    const allowed = rateLimit(
      `admin:maintenance:overview:${admin.id}`,
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

    const now = new Date();
    const dayStart = getColomboStartOfDay(now).toISOString();
    const dayEnd = getColomboEndOfDay(now).toISOString();

    const [
      userTotal,
      activeUsers,
      activityTotal,
      activeActivities,
      categoryTotal,
      todaysTransactions,
      pendingPrints,
      recentErrorsResult,
    ] = await Promise.all([
      countRows('users'),
      supabaseServer
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      countRows('activities'),
      supabaseServer
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      countRows('categories'),
      supabaseServer
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd),
      supabaseServer
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('print_status', 'pending')
        .is('cancelled_at', null),
      supabaseServer
        .from('error_logs')
        .select('id, message, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (activeUsers.error) throw activeUsers.error;
    if (activeActivities.error) throw activeActivities.error;
    if (todaysTransactions.error) throw todaysTransactions.error;
    if (pendingPrints.error) throw pendingPrints.error;
    if (recentErrorsResult.error) throw recentErrorsResult.error;

    return Response.json(
      {
        data: {
          counts: {
            users: userTotal,
            active_users: activeUsers.count ?? 0,
            activities: activityTotal,
            active_activities: activeActivities.count ?? 0,
            categories: categoryTotal,
            todays_transactions: todaysTransactions.count ?? 0,
            pending_prints: pendingPrints.count ?? 0,
          },
          recent_errors: recentErrorsResult.data ?? [],
          refreshed_at: new Date().toISOString(),
        },
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
