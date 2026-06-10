import { ERROR_CODES, HTTP_STATUS, RATE_LIMITS } from '@/lib/constants';
import {
  buildReportFilename,
  createExcelBufferSheets,
  createPdfBuffer,
  type ExportRow,
  type ExportSheet,
} from '@/lib/export-helpers';
import { toApiError, ValidationError } from '@/lib/errors';
import { formatColomboDateTime } from '@/lib/dateUtils';
import {
  fetchActivityReportData,
  fetchCashierReportData,
  fetchDailyReportData,
  fetchShiftReportData,
  fetchTransactionsReportData,
  parseReportQueryParams,
} from '@/lib/report-data';
import { rateLimit } from '@/lib/rateLimit';
import { requireAdminRequestUser } from '@/lib/request-user';
import { supabaseServer } from '@/lib/supabase-server';
import type {
  ActivityReportRow,
  CashierReportRow,
  DailyReportRow,
  ShiftReportRow,
  TransactionReportRow,
} from '@/types/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportKind = 'daily' | 'activity' | 'cashier' | 'transactions' | 'shift';
type ExportFormat = 'xlsx' | 'pdf';

function parseExportParams(url: string): {
  reportKind: ReportKind;
  format: ExportFormat;
} {
  const searchParams = new URL(url).searchParams;
  const reportType = searchParams.get('report_type');
  const format = searchParams.get('format');

  if (!reportType || !['daily', 'activity', 'cashier', 'transactions', 'shift'].includes(reportType)) {
    throw new ValidationError('Invalid report_type. Expected daily, activity, cashier, transactions, or shift.');
  }

  if (!format || !['xlsx', 'pdf'].includes(format)) {
    throw new ValidationError('Invalid format. Expected xlsx or pdf.');
  }

  return {
    reportKind: reportType as ReportKind,
    format: format as ExportFormat,
  };
}

function mapDailyRows(rows: DailyReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    date: row.date,
    cashier_name: row.cashier_name,
    total_transactions: row.totals.total_transactions,
    total_local_amount: row.totals.total_local_amount,
    total_foreign_amount: row.totals.total_foreign_amount,
    total_cash_amount: row.totals.total_cash_amount,
    total_card_amount: row.totals.total_card_amount,
    total_amount: row.totals.total_amount,
    activities: row.activities
      .map(
        (activity) =>
          `${activity.activity_name} (L ${activity.local_count}/${activity.local_total.toFixed(2)}, F ${activity.foreign_count}/${activity.foreign_total.toFixed(2)})`
      )
      .join('; '),
  }));
}

function mapActivityRows(rows: ActivityReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    activity_name: row.activity_name,
    local_count: row.local_count,
    foreign_count: row.foreign_count,
    total_count: row.total_count,
    local_total: row.local_total,
    foreign_total: row.foreign_total,
    total_amount: row.total_amount,
  }));
}

function mapCashierRows(rows: CashierReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    cashier_name: row.cashier_name,
    local_count: row.local_count,
    foreign_count: row.foreign_count,
    total_transactions: row.total_transactions,
    local_total: row.local_total,
    foreign_total: row.foreign_total,
    cash_total: row.cash_total,
    card_total: row.card_total,
    total_amount: row.total_amount,
    activities: row.activities
      .map(
        (activity) =>
          `${activity.activity_name} (L ${activity.local_count}/${activity.local_total.toFixed(2)}, F ${activity.foreign_count}/${activity.foreign_total.toFixed(2)}, Cash ${activity.cash_total.toFixed(2)}, Card ${activity.card_total.toFixed(2)})`
      )
      .join('; '),
  }));
}

function mapTransactionRows(rows: TransactionReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    created_at: row.created_at,
    token_number: row.token_number,
    txn_reference: row.txn_reference,
    activity_name: row.activity_name,
    cashier_name: row.cashier_name,
    price_type: row.price_type,
    amount: row.amount,
    print_status: row.print_status,
    cancelled: Boolean(row.cancelled_at),
    cancelled_at: row.cancelled_at,
    reprint_count: row.reprint_count,
  }));
}

function mapShiftRows(rows: ShiftReportRow[]): ExportRow[] {
  return rows.map((row) => ({
    created_at: formatColomboDateTime(new Date(row.created_at)),
    txn_reference: row.txn_reference,
    cashier_name: row.cashier_name,
    activity_name: row.activity_name,
    price_type: row.price_type,
    amount: row.amount,
    cancelled: Boolean(row.cancelled_at),
  }));
}

function mapShiftCashierTotals(rows: ShiftReportRow[], grandTotal: number): ExportRow[] {
  const byCashier = new Map<
    string,
    {
      cashier_name: string;
      ticket_count: number;
      cancelled_count: number;
      local_total: number;
      foreign_total: number;
      total_amount: number;
    }
  >();

  for (const row of rows) {
    const entry =
      byCashier.get(row.cashier_id) ??
      {
        cashier_name: row.cashier_name,
        ticket_count: 0,
        cancelled_count: 0,
        local_total: 0,
        foreign_total: 0,
        total_amount: 0,
      };

    if (row.cancelled_at) {
      entry.cancelled_count += 1;
    } else {
      entry.ticket_count += 1;
      entry.total_amount = Number((entry.total_amount + row.amount).toFixed(2));

      if (row.price_type === 'local') {
        entry.local_total = Number((entry.local_total + row.amount).toFixed(2));
      } else {
        entry.foreign_total = Number((entry.foreign_total + row.amount).toFixed(2));
      }
    }

    byCashier.set(row.cashier_id, entry);
  }

  const output: ExportRow[] = Array.from(byCashier.values())
    .sort((a, b) => b.total_amount - a.total_amount)
    .map((entry) => ({ ...entry }));

  output.push({
    cashier_name: 'GRAND TOTAL (excl. cancelled)',
    ticket_count: rows.filter((row) => !row.cancelled_at).length,
    cancelled_count: rows.filter((row) => Boolean(row.cancelled_at)).length,
    local_total: null,
    foreign_total: null,
    total_amount: grandTotal,
  });

  return output;
}

function getReportTitle(kind: ReportKind): string {
  switch (kind) {
    case 'daily':
      return 'Daily Report';
    case 'activity':
      return 'Activity Report';
    case 'cashier':
      return 'Cashier Report';
    case 'transactions':
      return 'Transactions Report';
    case 'shift':
      return 'Shift Report';
    default:
      return 'Report';
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAdminRequestUser();

    const allowed = rateLimit(
      `reports:export:${user.id}`,
      RATE_LIMITS.REPORT_EXPORT.attempts,
      RATE_LIMITS.REPORT_EXPORT.windowMs
    );

    if (!allowed) {
      return Response.json(
        {
          error: 'Too many export requests',
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: HTTP_STATUS.RATE_LIMITED }
      );
    }

    const filters = parseReportQueryParams(request.url);
    const { reportKind, format } = parseExportParams(request.url);

    let rows: ExportRow[] = [];
    let extraSheets: ExportSheet[] = [];

    if (reportKind === 'daily') {
      rows = mapDailyRows(await fetchDailyReportData(supabaseServer, user, filters));
    }

    if (reportKind === 'activity') {
      rows = mapActivityRows(await fetchActivityReportData(supabaseServer, user, filters));
    }

    if (reportKind === 'cashier') {
      rows = mapCashierRows(await fetchCashierReportData(supabaseServer, user, filters));
    }

    if (reportKind === 'transactions') {
      const transactions = await fetchTransactionsReportData(supabaseServer, user, {
        ...filters,
        page: 1,
        limit: 50000,
      });
      rows = mapTransactionRows(transactions.data);
    }

    if (reportKind === 'shift') {
      const shift = await fetchShiftReportData(supabaseServer, user, filters);
      rows = mapShiftRows(shift.data);
      rows.push({
        created_at: `${shift.window.start_local} -> ${shift.window.end_local}`,
        txn_reference: 'GRAND TOTAL (excl. cancelled)',
        cashier_name: null,
        activity_name: null,
        price_type: null,
        amount: shift.total_amount,
        cancelled: null,
      });
      extraSheets = [
        { name: 'Cashier Totals', rows: mapShiftCashierTotals(shift.data, shift.total_amount) },
      ];
    }

    const title = getReportTitle(reportKind);
    const filename = buildReportFilename(`${reportKind}-report`, format);

    if (format === 'xlsx') {
      const buffer = createExcelBufferSheets([{ name: title, rows }, ...extraSheets]);

      return new Response(buffer, {
        status: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const buffer = await createPdfBuffer(title, rows);

    return new Response(buffer, {
      status: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
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
