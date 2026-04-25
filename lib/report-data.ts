import type { SupabaseClient } from '@supabase/supabase-js';

import { ForbiddenError, ValidationError } from '@/lib/errors';
import type { RequestUserContext } from '@/lib/request-user';
import type { Database } from '@/types/database';
import type {
  ActivityReportRow,
  CashierReportRow,
  DailyActivityBreakdown,
  DailyReportRow,
  TransactionReportRow,
} from '@/types/report';

export type ReportQueryParams = {
  date?: string;
  from?: string;
  to?: string;
  cashier_id?: string;
  activity_id?: string;
  price_type?: 'local' | 'foreign';
  include_cancelled?: boolean;
  page?: number;
  limit?: number;
};

type ReportSupabaseClient = SupabaseClient<Database>;

type DailySummaryViewRow = Database['public']['Views']['daily_summary']['Row'];
type TransactionRow = Database['public']['Tables']['transactions']['Row'];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function clampPagination(page = 1, limit = 50) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit)
    ? Math.min(500, Math.max(1, Math.floor(limit)))
    : 50;

  return {
    page: safePage,
    limit: safeLimit,
  };
}

function parseDateParam(rawValue: string | null, key: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  if (!ISO_DATE_REGEX.test(rawValue)) {
    throw new ValidationError(`Invalid ${key}. Expected YYYY-MM-DD format.`);
  }

  return rawValue;
}

function parseBooleanParam(rawValue: string | null): boolean | undefined {
  if (rawValue === null) {
    return undefined;
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  throw new ValidationError('Invalid boolean value. Expected true or false.');
}

export function parseReportQueryParams(url: string): ReportQueryParams {
  const searchParams = new URL(url).searchParams;
  const date = parseDateParam(searchParams.get('date'), 'date');
  const from = parseDateParam(searchParams.get('from'), 'from');
  const to = parseDateParam(searchParams.get('to'), 'to');

  if (date && (from || to)) {
    throw new ValidationError('Use either date or from/to filters, not both.');
  }

  if (from && to && from > to) {
    throw new ValidationError('Invalid date range. from must be before or equal to to.');
  }

  const priceType = searchParams.get('price_type');
  let parsedPriceType: 'local' | 'foreign' | undefined;

  if (priceType) {
    if (priceType !== 'local' && priceType !== 'foreign') {
      throw new ValidationError('Invalid price_type. Expected local or foreign.');
    }

    parsedPriceType = priceType;
  }

  const pageValue = searchParams.get('page');
  const limitValue = searchParams.get('limit');
  const parsedPage = pageValue ? Number.parseInt(pageValue, 10) : undefined;
  const parsedLimit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  if (pageValue && (!Number.isFinite(parsedPage) || (parsedPage ?? 0) < 1)) {
    throw new ValidationError('Invalid page. Expected positive integer.');
  }

  if (limitValue && (!Number.isFinite(parsedLimit) || (parsedLimit ?? 0) < 1)) {
    throw new ValidationError('Invalid limit. Expected positive integer.');
  }

  return {
    date,
    from,
    to,
    cashier_id: searchParams.get('cashier_id') ?? undefined,
    activity_id: searchParams.get('activity_id') ?? undefined,
    price_type: parsedPriceType,
    include_cancelled: parseBooleanParam(searchParams.get('include_cancelled')),
    page: parsedPage,
    limit: parsedLimit,
  };
}

function ensureAdminOrVendor(requestUser: RequestUserContext) {
  if (requestUser.role !== 'admin' && requestUser.role !== 'vendor') {
    throw new ForbiddenError('Forbidden');
  }
}

function toNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function getOrCreateActivityBreakdown(
  activitiesMap: Map<string, DailyActivityBreakdown>,
  activityId: string,
  activityName: string
): DailyActivityBreakdown {
  const existing = activitiesMap.get(activityId);

  if (existing) {
    return existing;
  }

  const created: DailyActivityBreakdown = {
    activity_id: activityId,
    activity_name: activityName,
    local_count: 0,
    local_total: 0,
    foreign_count: 0,
    foreign_total: 0,
  };

  activitiesMap.set(activityId, created);
  return created;
}

export async function fetchDailyReportData(
  supabase: ReportSupabaseClient,
  requestUser: RequestUserContext,
  params: ReportQueryParams
): Promise<DailyReportRow[]> {
  let query = supabase
    .from('daily_summary')
    .select('*')
    .order('sale_date', { ascending: false });

  if (params.date) {
    query = query.eq('sale_date', params.date);
  } else {
    if (params.from) {
      query = query.gte('sale_date', params.from);
    }

    if (params.to) {
      query = query.lte('sale_date', params.to);
    }
  }

  if (requestUser.role === 'vendor') {
    query = query.eq('vendor_id', requestUser.id);
  } else if (requestUser.role !== 'admin') {
    query = query.eq('cashier_id', requestUser.id);
  } else if (params.cashier_id) {
    query = query.eq('cashier_id', params.cashier_id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as DailySummaryViewRow[];
  const cashierIds = Array.from(
    new Set(rows.map((row) => row.cashier_id).filter((value): value is string => Boolean(value)))
  );

  const cashierNameMap = new Map<string, string>();

  if (cashierIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', cashierIds);

    if (usersError) {
      throw usersError;
    }

    for (const user of (users ?? []) as Array<{ id: string; display_name: string }>) {
      cashierNameMap.set(user.id, user.display_name);
    }
  }

  const grouped = new Map<
    string,
    {
      row: DailyReportRow;
      activityMap: Map<string, DailyActivityBreakdown>;
    }
  >();

  for (const summaryRow of rows) {
    if (!summaryRow.cashier_id || !summaryRow.sale_date) {
      continue;
    }

    const key = `${summaryRow.sale_date}|${summaryRow.cashier_id}`;
    const count = toNumber(summaryRow.count);
    const amount = toNumber(summaryRow.total_amount);

    const existing = grouped.get(key);
    const entity =
      existing ??
      {
        row: {
          date: summaryRow.sale_date,
          cashier_id: summaryRow.cashier_id,
          cashier_name:
            cashierNameMap.get(summaryRow.cashier_id) ??
            `Cashier ${summaryRow.cashier_id.slice(0, 8)}`,
          activities: [],
          totals: {
            total_transactions: 0,
            total_local_amount: 0,
            total_foreign_amount: 0,
            total_cash_amount: 0,
            total_card_amount: 0,
            total_amount: 0,
          },
        },
        activityMap: new Map<string, DailyActivityBreakdown>(),
      };

    entity.row.totals.total_transactions += count;
    entity.row.totals.total_amount = Number((entity.row.totals.total_amount + amount).toFixed(2));

    // Handle payment method summary
    if ((summaryRow as Record<string, unknown>).payment_method === 'card') {
      entity.row.totals.total_card_amount = Number((entity.row.totals.total_card_amount + amount).toFixed(2));
    } else {
      entity.row.totals.total_cash_amount = Number((entity.row.totals.total_cash_amount + amount).toFixed(2));
    }

    if (summaryRow.price_type === 'local') {
      entity.row.totals.total_local_amount = Number(
        (entity.row.totals.total_local_amount + amount).toFixed(2)
      );
    }

    if (summaryRow.price_type === 'foreign') {
      entity.row.totals.total_foreign_amount = Number(
        (entity.row.totals.total_foreign_amount + amount).toFixed(2)
      );
    }

    if (summaryRow.activity_id) {
      const activity = getOrCreateActivityBreakdown(
        entity.activityMap,
        summaryRow.activity_id,
        summaryRow.activity_name ?? `Activity ${summaryRow.activity_id.slice(0, 8)}`
      );

      if (summaryRow.price_type === 'local') {
        activity.local_count += count;
        activity.local_total = Number((activity.local_total + amount).toFixed(2));
      } else {
        activity.foreign_count += count;
        activity.foreign_total = Number((activity.foreign_total + amount).toFixed(2));
      }
    }

    grouped.set(key, entity);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item.row,
      activities: Array.from(item.activityMap.values()).sort((a, b) =>
        a.activity_name.localeCompare(b.activity_name)
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchActivityReportData(
  supabase: ReportSupabaseClient,
  requestUser: RequestUserContext,
  params: ReportQueryParams
): Promise<ActivityReportRow[]> {
  ensureAdminOrVendor(requestUser);

  let query = supabase
    .from('daily_summary')
    .select('*')
    .order('sale_date', { ascending: false });

  if (params.date) {
    query = query.eq('sale_date', params.date);
  } else {
    if (params.from) {
      query = query.gte('sale_date', params.from);
    }

    if (params.to) {
      query = query.lte('sale_date', params.to);
    }
  }

  if (requestUser.role === 'vendor') { query = query.eq('vendor_id', requestUser.id); }
    if (params.activity_id) {
    query = query.eq('activity_id', params.activity_id);
  }

  if (params.cashier_id) {
    query = query.eq('cashier_id', params.cashier_id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as DailySummaryViewRow[];
  const grouped = new Map<string, ActivityReportRow>();

  for (const row of rows) {
    if (!row.activity_id) {
      continue;
    }

    const count = toNumber(row.count);
    const amount = toNumber(row.total_amount);

    const existing =
      grouped.get(row.activity_id) ??
      {
        activity_id: row.activity_id,
        activity_name: row.activity_name ?? `Activity ${row.activity_id.slice(0, 8)}`,
        local_count: 0,
        foreign_count: 0,
        total_count: 0,
        local_total: 0,
        foreign_total: 0,
        total_amount: 0,
      };

    existing.total_count += count;
    existing.total_amount = Number((existing.total_amount + amount).toFixed(2));

    if (row.price_type === 'local') {
      existing.local_count += count;
      existing.local_total = Number((existing.local_total + amount).toFixed(2));
    } else if (row.price_type === 'foreign') {
      existing.foreign_count += count;
      existing.foreign_total = Number((existing.foreign_total + amount).toFixed(2));
    }

    grouped.set(row.activity_id, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => b.total_amount - a.total_amount);
}

export async function fetchCashierReportData(
  supabase: ReportSupabaseClient,
  requestUser: RequestUserContext,
  params: ReportQueryParams
): Promise<CashierReportRow[]> {
  ensureAdminOrVendor(requestUser);

  let query = supabase
    .from('daily_summary')
    .select('*')
    .order('sale_date', { ascending: false });

  if (params.date) {
    query = query.eq('sale_date', params.date);
  } else {
    if (params.from) {
      query = query.gte('sale_date', params.from);
    }

    if (params.to) {
      query = query.lte('sale_date', params.to);
    }
  }

  if (params.cashier_id) {
    query = query.eq('cashier_id', params.cashier_id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as DailySummaryViewRow[];
  const cashierIds = Array.from(
    new Set(rows.map((row) => row.cashier_id).filter((value): value is string => Boolean(value)))
  );

  const cashierNameMap = new Map<string, string>();

  if (cashierIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', cashierIds);

    if (usersError) {
      throw usersError;
    }

    for (const user of (users ?? []) as Array<{ id: string; display_name: string }>) {
      cashierNameMap.set(user.id, user.display_name);
    }
  }

  const grouped = new Map<string, CashierReportRow>();

  for (const row of rows) {
    if (!row.cashier_id) {
      continue;
    }

    const count = toNumber(row.count);
    const amount = toNumber(row.total_amount);

    const existing =
      grouped.get(row.cashier_id) ??
      {
        cashier_id: row.cashier_id,
        cashier_name:
          cashierNameMap.get(row.cashier_id) ?? `Cashier ${row.cashier_id.slice(0, 8)}`,
        local_count: 0,
        foreign_count: 0,
        total_transactions: 0,
        local_total: 0,
        foreign_total: 0,
        cash_total: 0,
        card_total: 0,
        total_amount: 0,
      };

    existing.total_transactions += count;
    existing.total_amount = Number((existing.total_amount + amount).toFixed(2));

    if ((row as Record<string, unknown>).payment_method === 'card') {
      existing.card_total = Number((existing.card_total + amount).toFixed(2));
    } else {
      existing.cash_total = Number((existing.cash_total + amount).toFixed(2));
    }

    if (row.price_type === 'local') {
      existing.local_count += count;
      existing.local_total = Number((existing.local_total + amount).toFixed(2));
    } else if (row.price_type === 'foreign') {
      existing.foreign_count += count;
      existing.foreign_total = Number((existing.foreign_total + amount).toFixed(2));
    }

    grouped.set(row.cashier_id, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => b.total_amount - a.total_amount);
}

export async function fetchTransactionsReportData(
  supabase: ReportSupabaseClient,
  requestUser: RequestUserContext,
  params: ReportQueryParams
): Promise<{
  data: TransactionReportRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  ensureAdminOrVendor(requestUser);

  const { page, limit } = clampPagination(params.page, params.limit);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.cashier_id) {
    query = query.eq('cashier_id', params.cashier_id);
  }

  if (requestUser.role === 'vendor') { query = query.eq('vendor_id', requestUser.id); }
    if (params.activity_id) {
    query = query.eq('activity_id', params.activity_id);
  }

  if (params.price_type) {
    query = query.eq('price_type', params.price_type);
  }

  if (params.from) {
    query = query.gte('created_at', `${params.from}T00:00:00.000Z`);
  }

  if (params.to) {
    query = query.lte('created_at', `${params.to}T23:59:59.999Z`);
  }

  if (!params.include_cancelled) {
    query = query.is('cancelled_at', null);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TransactionRow[];
  const activityIds = Array.from(new Set(rows.map((row) => row.activity_id)));
  const cashierIds = Array.from(new Set(rows.map((row) => row.cashier_id)));
  const transactionIds = rows.map((row) => row.id);

  const activityNameMap = new Map<string, string>();
  const cashierNameMap = new Map<string, string>();
  const tokenMap = new Map<string, { token_number: string | null; reprint_count: number }>();

  if (activityIds.length > 0) {
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, name')
      .in('id', activityIds);

    if (activitiesError) {
      throw activitiesError;
    }

    for (const activity of (activities ?? []) as Array<{ id: string; name: string }>) {
      activityNameMap.set(activity.id, activity.name);
    }
  }

  if (cashierIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', cashierIds);

    if (usersError) {
      throw usersError;
    }

    for (const user of (users ?? []) as Array<{ id: string; display_name: string }>) {
      cashierNameMap.set(user.id, user.display_name);
    }
  }

  if (transactionIds.length > 0) {
    const { data: tokens, error: tokensError } = await supabase
      .from('tokens')
      .select('transaction_id, token_number, reprint_count')
      .in('transaction_id', transactionIds);

    if (tokensError) {
      throw tokensError;
    }

    for (const token of (tokens ?? []) as Array<{
      transaction_id: string;
      token_number: string;
      reprint_count: number;
    }>) {
      tokenMap.set(token.transaction_id, {
        token_number: token.token_number,
        reprint_count: token.reprint_count,
      });
    }
  }

  const output: TransactionReportRow[] = rows.map((row) => {
    const token = tokenMap.get(row.id);

    return {
      id: row.id,
      token_number: token?.token_number ?? null,
      txn_reference: row.txn_reference,
      activity_id: row.activity_id,
      activity_name: activityNameMap.get(row.activity_id) ?? row.activity_id,
      cashier_id: row.cashier_id,
      cashier_name: cashierNameMap.get(row.cashier_id) ?? row.cashier_id,
      price_type: row.price_type,
      amount: row.amount,
      print_status: row.print_status,
      created_at: row.created_at,
      cancelled_at: row.cancelled_at,
      reprint_count: token?.reprint_count ?? 0,
    };
  });

  const total = count ?? output.length;

  return {
    data: output,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
