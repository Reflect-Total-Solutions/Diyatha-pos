import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import {
  fetchDailyReportData,
  parseReportQueryParams,
} from '@/lib/report-data';
import { requireRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();

    const allowed = rateLimit(
      `reports:daily:${user.id}`,
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

    const filters = parseReportQueryParams(request.url);
    const data = await fetchDailyReportData(supabaseServer, user, filters);

    return Response.json(
      {
        data,
        total: data.length,
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
