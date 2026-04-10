import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import { config } from '@/lib/config';
import { PrintError, toApiError } from '@/lib/errors';
import { resolvePrinterTarget } from '@/lib/printer-discovery';
import { printActivityTicket } from '@/lib/printer';
import { PrintRequestSchema, validateInput } from '@/lib/schemas';
import { supabaseServer } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rateLimit';
import { requireRequestUser } from '@/lib/request-user';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type ActivityRow = Database['public']['Tables']['activities']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];
type TokenRow = Database['public']['Tables']['tokens']['Row'];

async function getTransactionTokenStats(groupId: string, transactionId: string) {
  const { data, error } = await supabaseServer
    .from('transactions')
    .select('*')
    .eq('transaction_group_id', groupId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error || !data || data.length === 0) {
    return {
      tokenIndex: 1,
      tokenTotal: 1,
    };
  }

  const transactionRows = data as unknown as Array<{ id: string }>;
  const index = transactionRows.findIndex((item) => item.id === transactionId);

  return {
    tokenIndex: index >= 0 ? index + 1 : 1,
    tokenTotal: transactionRows.length,
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireRequestUser();

    const allowed = rateLimit(
      `print:${user.id}`,
      RATE_LIMITS.PRINT.attempts,
      RATE_LIMITS.PRINT.windowMs
    );

    if (!allowed) {
      return Response.json(
        {
          error: 'Too many print requests',
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const payload = await request.json().catch(() => null);
    const validation = validateInput(PrintRequestSchema, payload);

    if (!validation.valid) {
      return Response.json(
        {
          error: 'Invalid print request',
          code: ERROR_CODES.VALIDATION_ERROR,
          details: validation.errors,
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { data: transaction } = await supabaseServer
      .from('transactions')
      .select('*')
      .eq('id', validation.data.transaction_id)
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

    const { data: activity } = await supabaseServer
      .from('activities')
      .select('*')
      .eq('id', transactionRecord.activity_id)
      .maybeSingle();

    const activityRecord = activity as unknown as ActivityRow | null;

    if (!activityRecord) {
      return Response.json(
        {
          error: 'Activity not found',
          code: ERROR_CODES.NOT_FOUND,
        },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    const { data: cashier } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', transactionRecord.cashier_id)
      .maybeSingle();

    const cashierRecord = cashier as unknown as UserRow | null;

    const { tokenIndex, tokenTotal } = await getTransactionTokenStats(
      transactionRecord.transaction_group_id,
      transactionRecord.id
    );

    const { data: existingToken } = await supabaseServer
      .from('tokens')
      .select('*')
      .eq('transaction_id', transactionRecord.id)
      .maybeSingle();

    const existingTokenRecord = existingToken as unknown as TokenRow | null;

    if (existingTokenRecord && transactionRecord.print_status === 'printed') {
      return Response.json(
        {
          error: 'Ticket is already printed. Use reprint endpoint.',
          code: ERROR_CODES.RESOURCE_CONFLICT,
        },
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    const generatedTokenResult = await supabaseServer.rpc('generate_token_number');
    const generatedToken = generatedTokenResult.data as unknown as string | null;

    const tokenNumber = existingTokenRecord?.token_number ?? generatedToken;

    if (!tokenNumber) {
      return Response.json(
        {
          error: 'Unable to generate token number',
          code: ERROR_CODES.TRANSACTION_FAILED,
        },
        { status: HTTP_STATUS.SERVER_ERROR }
      );
    }

    if (!existingTokenRecord) {
      await supabaseServer.from('tokens').insert(
        {
          transaction_id: transactionRecord.id,
          token_number: tokenNumber,
          token_index: tokenIndex,
          token_total: tokenTotal,
          printed_at: new Date().toISOString(),
        } as never
      );
    }

    const targetIp = validation.data.targetIp?.trim();
    const targetInterface = validation.data.targetInterface?.trim();

    let targetPrinter:
      | { interface: string; ip?: string; port?: number }
      | { ip: string; port: number; interface?: string }
      | null = null;

    if (targetInterface) {
      targetPrinter = { interface: targetInterface };
    } else if (targetIp) {
      targetPrinter = { ip: targetIp, port: 9100 };
    } else if (config.printer.interface) {
      targetPrinter = { interface: config.printer.interface };
    } else {
      const discovered = await resolvePrinterTarget();
      targetPrinter = discovered
        ? {
            ip: discovered.ip,
            port: discovered.port,
          }
        : null;
    }

    if (!targetPrinter) {
      await supabaseServer
        .from('transactions')
        .update({ print_status: 'failed' } as never)
        .eq('id', transactionRecord.id);

      return Response.json(
        {
          error: 'Printer unavailable',
          code: ERROR_CODES.PRINTER_OFFLINE,
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }

    const printResult = await printActivityTicket({
      target: targetPrinter,
      transactionId: transactionRecord.id,
      payload: {
        tokenNumber,
        activityName: activityRecord.name,
        amount: transactionRecord.amount,
        transactionNumber: transactionRecord.txn_reference,
        cashierName: cashierRecord?.display_name ?? user.displayName,
        tokenIndex: existingTokenRecord?.token_index ?? tokenIndex,
        tokenTotal: existingTokenRecord?.token_total ?? tokenTotal,
        transactionCreatedAt: transactionRecord.created_at,
      },
    });

    await supabaseServer
      .from('transactions')
      .update(
        {
          print_status: 'printed',
          printed_at: printResult.printedAt,
          token_index: existingTokenRecord?.token_index ?? tokenIndex,
          token_total: existingTokenRecord?.token_total ?? tokenTotal,
        } as never
      )
      .eq('id', transactionRecord.id);

    await supabaseServer.from('audit_log').insert(
      {
        user_id: user.id,
        action: 'PRINT',
        entity_type: 'transaction',
        entity_id: transactionRecord.id,
        metadata: {
          token_number: tokenNumber,
          printer_ip: printResult.target.ip,
          printer_port: printResult.target.port,
          printer_interface: printResult.target.interface ?? null,
        },
        created_at: new Date().toISOString(),
      } as never
    );

    return Response.json(
      {
        data: {
          success: true,
          message: 'Ticket printed successfully',
          token_number: tokenNumber,
          token_index: existingTokenRecord?.token_index ?? tokenIndex,
          token_total: existingTokenRecord?.token_total ?? tokenTotal,
          printed_at: printResult.printedAt,
        },
      },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    const apiError = toApiError(error);

    if (error instanceof PrintError && error.transactionId) {
      await supabaseServer
        .from('transactions')
        .update({ print_status: 'failed' } as never)
        .eq('id', error.transactionId);
    }

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
