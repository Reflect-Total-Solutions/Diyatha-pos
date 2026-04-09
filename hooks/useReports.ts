'use client';

import { useCallback, useState } from 'react';

import type {
  ActivityReportRow,
  CashierReportRow,
  DailyReportRow,
  TransactionReportRow,
} from '@/types/report';

export type ReportFilters = {
  date?: string;
  from?: string;
  to?: string;
  cashierId?: string;
  activityId?: string;
  priceType?: 'local' | 'foreign';
  includeCancelled?: boolean;
  page?: number;
  limit?: number;
};

type ListResponse<T> = {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
};

type MutationResult = {
  success: boolean;
  error?: string;
};

function buildQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams();

  if (filters.date) {
    params.set('date', filters.date);
  }

  if (filters.from) {
    params.set('from', filters.from);
  }

  if (filters.to) {
    params.set('to', filters.to);
  }

  if (filters.cashierId) {
    params.set('cashier_id', filters.cashierId);
  }

  if (filters.activityId) {
    params.set('activity_id', filters.activityId);
  }

  if (filters.priceType) {
    params.set('price_type', filters.priceType);
  }

  if (filters.includeCancelled !== undefined) {
    params.set('include_cancelled', String(filters.includeCancelled));
  }

  if (filters.page !== undefined) {
    params.set('page', String(filters.page));
  }

  if (filters.limit !== undefined) {
    params.set('limit', String(filters.limit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }

  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

export function useReports() {
  const [daily, setDaily] = useState<DailyReportRow[]>([]);
  const [activity, setActivity] = useState<ActivityReportRow[]>([]);
  const [cashier, setCashier] = useState<CashierReportRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionReportRow[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDailyReport = useCallback(async (filters: ReportFilters = {}): Promise<MutationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/daily${buildQueryString(filters)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<DailyReportRow>;

      if (!response.ok) {
        setDaily([]);
        setTotal(0);
        setError(payload.error ?? 'Unable to load daily report');
        return { success: false, error: payload.error ?? 'Unable to load daily report' };
      }

      setDaily(payload.data ?? []);
      setTotal(payload.total ?? (payload.data ?? []).length);
      return { success: true };
    } catch {
      setDaily([]);
      setTotal(0);
      setError('Unable to load daily report');
      return { success: false, error: 'Unable to load daily report' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadActivityReport = useCallback(async (filters: ReportFilters = {}): Promise<MutationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/activity${buildQueryString(filters)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<ActivityReportRow>;

      if (!response.ok) {
        setActivity([]);
        setTotal(0);
        setError(payload.error ?? 'Unable to load activity report');
        return { success: false, error: payload.error ?? 'Unable to load activity report' };
      }

      setActivity(payload.data ?? []);
      setTotal(payload.total ?? (payload.data ?? []).length);
      return { success: true };
    } catch {
      setActivity([]);
      setTotal(0);
      setError('Unable to load activity report');
      return { success: false, error: 'Unable to load activity report' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCashierReport = useCallback(async (filters: ReportFilters = {}): Promise<MutationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/cashier${buildQueryString(filters)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<CashierReportRow>;

      if (!response.ok) {
        setCashier([]);
        setTotal(0);
        setError(payload.error ?? 'Unable to load cashier report');
        return { success: false, error: payload.error ?? 'Unable to load cashier report' };
      }

      setCashier(payload.data ?? []);
      setTotal(payload.total ?? (payload.data ?? []).length);
      return { success: true };
    } catch {
      setCashier([]);
      setTotal(0);
      setError('Unable to load cashier report');
      return { success: false, error: 'Unable to load cashier report' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTransactionsReport = useCallback(async (filters: ReportFilters = {}): Promise<MutationResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/transactions${buildQueryString(filters)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<TransactionReportRow>;

      if (!response.ok) {
        setTransactions([]);
        setTotal(0);
        setPage(1);
        setLimit(filters.limit ?? 50);
        setTotalPages(0);
        setError(payload.error ?? 'Unable to load transaction report');
        return { success: false, error: payload.error ?? 'Unable to load transaction report' };
      }

      setTransactions(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? filters.page ?? 1);
      setLimit(payload.limit ?? filters.limit ?? 50);
      setTotalPages(payload.totalPages ?? 0);
      return { success: true };
    } catch {
      setTransactions([]);
      setTotal(0);
      setPage(1);
      setLimit(filters.limit ?? 50);
      setTotalPages(0);
      setError('Unable to load transaction report');
      return { success: false, error: 'Unable to load transaction report' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportReport = useCallback(async (
    reportType: 'daily' | 'activity' | 'cashier' | 'transactions',
    format: 'xlsx' | 'pdf',
    filters: ReportFilters = {}
  ): Promise<MutationResult> => {
    setIsExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('report_type', reportType);
      params.set('format', format);

      const filterParams = new URLSearchParams(buildQueryString(filters).replace('?', ''));
      for (const [key, value] of filterParams.entries()) {
        params.set(key, value);
      }

      const response = await fetch(`/api/reports/export?${params.toString()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const errorMessage = payload.error ?? 'Unable to export report';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const blob = await response.blob();
      const filename =
        parseFilenameFromDisposition(response.headers.get('content-disposition')) ??
        `${reportType}-report.${format}`;

      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      return { success: true };
    } catch {
      setError('Unable to export report');
      return { success: false, error: 'Unable to export report' };
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    daily,
    activity,
    cashier,
    transactions,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    isExporting,
    error,
    loadDailyReport,
    loadActivityReport,
    loadCashierReport,
    loadTransactionsReport,
    exportReport,
  };
}
