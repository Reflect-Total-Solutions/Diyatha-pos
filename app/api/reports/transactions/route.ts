import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import {
  fetchTransactionsReportData,
  parseReportQueryParams,
} from '@/lib/report-data';
import { requireAdminRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAdminRequestUser();

    const allowed = rateLimit(
      `reports:transactions:${user.id}`,
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
    const result = await fetchTransactionsReportData(supabaseServer, user, filters);

    return Response.json(
      {
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
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
