import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { toApiError } from '@/lib/errors';
import { resolvePrinterTarget } from '@/lib/printer-discovery';
import { printActivityTicket } from '@/lib/printer';
import { supabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TokenRow = Database['public']['Tables']['tokens']['Row'];
type ActivityRow = Database['public']['Tables']['activities']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

function getMaxReprintCount(): number {
  const parsed = Number.parseInt(process.env.MAX_REPRINT_COUNT ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRequestUser();
    const { id } = await context.params;

    const allowed = rateLimit(
      `print:reprint:${user.id}`,
      RATE_LIMITS.PRINT.attempts,
      RATE_LIMITS.PRINT.windowMs
    );

    if (!allowed) {
      return Response.json(
        {
          error: 'Too many reprint requests',
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const { data: transaction } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const transactionRecord = transaction as unknown as TransactionRow | null;

    if (!transactionRecord) {
      return Response.json(
        {
          error: 'Transaction not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (user.role !== 'admin' && transactionRecord.cashier_id !== user.id) {
      return Response.json(
        {
          error: 'Forbidden',
          code: ERROR_CODES.FORBIDDEN,
        },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const { data: token } = await supabaseServer
      .from('tokens')
      .select('*')
      .eq('transaction_id', transactionRecord.id)
      .maybeSingle();

    const tokenRecord = token as unknown as TokenRow | null;

    if (!tokenRecord) {
      return Response.json(
        {
          error: 'Token not found for transaction',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const maxReprintCount = getMaxReprintCount();
    if (tokenRecord.reprint_count >= maxReprintCount) {
      return Response.json(
        {
          error: 'Maximum reprint count reached',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    const [{ data: activity }, { data: cashier }, targetPrinter] = await Promise.all([
      supabaseServer.from('activities').select('*').eq('id', transactionRecord.activity_id).maybeSingle(),
      supabaseServer.from('users').select('*').eq('id', transactionRecord.cashier_id).maybeSingle(),
      resolvePrinterTarget(),
    ]);

    const activityRecord = activity as unknown as ActivityRow | null;
    const cashierRecord = cashier as unknown as UserRow | null;

    if (!activityRecord) {
      return Response.json(
        {
          error: 'Activity not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (!targetPrinter) {
      return Response.json(
        {
          error: 'Printer unavailable',
          code: ERROR_CODES.PRINTER_OFFLINE,
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    const printResult = await printActivityTicket({
      target: {
        ip: targetPrinter.ip,
        port: targetPrinter.port,
      },
      transactionId: transactionRecord.id,
      payload: {
        tokenNumber: tokenRecord.token_number,
        activityName: activityRecord.name,
        amount: transactionRecord.amount,
        transactionNumber: transactionRecord.txn_reference,
        cashierName: cashierRecord?.display_name ?? user.displayName,
        tokenIndex: tokenRecord.token_index,
        tokenTotal: tokenRecord.token_total,
        transactionCreatedAt: transactionRecord.created_at,
      },
    });

    const nowIso = new Date().toISOString();
    await supabaseServer
      .from('tokens')
      .update(
        {
          reprint_count: tokenRecord.reprint_count + 1,
          first_reprinted_at: tokenRecord.first_reprinted_at ?? nowIso,
          latest_reprinted_at: nowIso,
        } as never
      )
      .eq('id', tokenRecord.id);

    await supabaseServer
      .from('transactions')
      .update(
        {
          print_status: 'printed',
          printed_at: printResult.printedAt,
        } as never
      )
      .eq('id', transactionRecord.id);

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'REPRINT',
        entity_type: 'transaction',
        entity_id: transactionRecord.id,
        metadata: {
          token_number: tokenRecord.token_number,
          reprint_count: tokenRecord.reprint_count + 1,
          printer_ip: printResult.target.ip,
          printer_port: printResult.target.port,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: {
          success: true,
          message: 'Ticket reprinted successfully',
          token_number: tokenRecord.token_number,
          token_index: tokenRecord.token_index,
          token_total: tokenRecord.token_total,
          printed_at: printResult.printedAt,
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
