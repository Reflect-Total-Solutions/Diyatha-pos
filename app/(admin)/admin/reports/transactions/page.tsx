'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useReports } from '@/hooks/useReports';

function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsReportPage() {
  const {
    transactions,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    isExporting,
    error,
    loadTransactionsReport,
    exportReport,
  } = useReports();

  const [from, setFrom] = useState<string>(getTodayDateValue());
  const [to, setTo] = useState<string>(getTodayDateValue());
  const [cashierId, setCashierId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [priceType, setPriceType] = useState<'all' | 'local' | 'foreign'>('all');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [pageSize, setPageSize] = useState(50);

  const baseFilters = useMemo(
    () => ({
      from,
      to,
      cashierId: cashierId || undefined,
      activityId: activityId || undefined,
      priceType: priceType === 'all' ? undefined : priceType,
      includeCancelled,
    }),
    [activityId, cashierId, from, includeCancelled, priceType, to]
  );

  useEffect(() => {
    void loadTransactionsReport({
      ...baseFilters,
      page: 1,
      limit: pageSize,
    });
  }, [baseFilters, loadTransactionsReport, pageSize]);

  async function goToPage(nextPage: number) {
    await loadTransactionsReport({
      ...baseFilters,
      page: nextPage,
      limit: pageSize,
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Transactions Report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Detailed transaction listing with filtering and export options.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-7">
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Cashier ID
            <input
              type="text"
              value={cashierId}
              onChange={(event) => setCashierId(event.target.value)}
              placeholder="UUID"
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Activity ID
            <input
              type="text"
              value={activityId}
              onChange={(event) => setActivityId(event.target.value)}
              placeholder="UUID"
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Price Type
            <select
              value={priceType}
              onChange={(event) => setPriceType(event.target.value as 'all' | 'local' | 'foreign')}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            >
              <option value="all">All</option>
              <option value="local">Local</option>
              <option value="foreign">Foreign</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Page Size
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(event) => setIncludeCancelled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Include cancelled
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void goToPage(1)}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void exportReport('transactions', 'xlsx', baseFilters)}
            disabled={isExporting || isLoading}
          >
            Export XLSX
          </Button>

          <Button
            type="button"
            onClick={() => void exportReport('transactions', 'pdf', baseFilters)}
            disabled={isExporting || isLoading}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Created</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Token</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Reference</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Activity</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Cashier</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Price Type</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Print</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Cancelled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {transactions.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-slate-800">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-800">{row.token_number ?? '-'}</td>
                <td className="px-3 py-2 text-slate-800">{row.txn_reference}</td>
                <td className="px-3 py-2 text-slate-800">{row.activity_name}</td>
                <td className="px-3 py-2 text-slate-800">{row.cashier_name}</td>
                <td className="px-3 py-2 text-slate-800">{row.price_type}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{row.amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-800">{row.print_status}</td>
                <td className="px-3 py-2 text-slate-800">{row.cancelled_at ? 'Yes' : 'No'}</td>
              </tr>
            ))}

            {!isLoading && transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  No records found for selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          {isLoading
            ? 'Loading report…'
            : `Showing page ${page} of ${totalPages || 1}. Page size: ${limit}. Total records: ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void goToPage(Math.max(1, page - 1))}
            disabled={isLoading || page <= 1}
          >
            Previous
          </Button>

          <Button
            type="button"
            onClick={() => void goToPage(Math.min(Math.max(totalPages, 1), page + 1))}
            disabled={isLoading || page >= Math.max(totalPages, 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
