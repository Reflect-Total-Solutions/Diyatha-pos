import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SummaryRow = {
  total_count: number;
  local_count: number;
  foreign_count: number;
  cancelled_count: number;
  local_amount: number;
  foreign_amount: number;
  cash_amount: number;
  card_amount: number;
  total_amount: number;
};

const EMPTY_SUMMARY: SummaryRow = {
  total_count: 0,
  local_count: 0,
  foreign_count: 0,
  cancelled_count: 0,
  local_amount: 0,
  foreign_amount: 0,
  cash_amount: 0,
  card_amount: 0,
  total_amount: 0,
};

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser();
    const supabase = await createSupabaseServerClient();

    const allowed = rateLimit(
      `transactions:summary:${user.id}`,
      RATE_LIMITS.READ_OPERATIONS.attempts,
      RATE_LIMITS.READ_OPERATIONS.windowMs
    );

    if (!allowed) {
      return Response.json(
        { error: 'Too many requests', code: ERROR_CODES.RATE_LIMIT_EXCEEDED },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const requestedCashierId = searchParams.get('cashier_id') ?? undefined;

    if (!startDate || !endDate) {
      return Response.json(
        {
          error: 'start_date and end_date are required',
          code: ERROR_CODES.VALIDATION_ERROR,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Cashiers can only ever see their own summary; admins may target a cashier.
    const cashierId = user.role === 'cashier' ? user.id : requestedCashierId ?? user.id;

    // get_pos_daily_summary is not in the generated Database types yet, so cast
    // the rpc name/args to satisfy the typed client without using `any`.
    const { data, error } = await supabase.rpc('get_pos_daily_summary' as never, {
      p_cashier_id: cashierId,
      p_from: startDate,
      p_to: endDate,
    } as never);

    if (error) {
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as SummaryRow | undefined;

    // The RPC returns numeric columns as strings over the wire; coerce to numbers.
    const summary: SummaryRow = row
      ? {
          total_count: Number(row.total_count) || 0,
          local_count: Number(row.local_count) || 0,
          foreign_count: Number(row.foreign_count) || 0,
          cancelled_count: Number(row.cancelled_count) || 0,
          local_amount: Number(row.local_amount) || 0,
          foreign_amount: Number(row.foreign_amount) || 0,
          cash_amount: Number(row.cash_amount) || 0,
          card_amount: Number(row.card_amount) || 0,
          total_amount: Number(row.total_amount) || 0,
        }
      : EMPTY_SUMMARY;

    return Response.json({ data: summary }, { status: HTTP_STATUS.OK });
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
