'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useReports } from '@/hooks/useReports';

function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyReportPage() {
  const {
    daily,
    total,
    isLoading,
    isExporting,
    error,
    loadDailyReport,
    exportReport,
  } = useReports();

  const [date, setDate] = useState<string>(getTodayDateValue());

  const filters = useMemo(() => ({ date }), [date]);

  useEffect(() => {
    void loadDailyReport(filters);
  }, [filters, loadDailyReport]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Daily Report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sales totals grouped by cashier and date.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadDailyReport(filters)}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void exportReport('daily', 'xlsx', filters)}
            disabled={isExporting || isLoading}
          >
            Export XLSX
          </Button>

          <Button
            type="button"
            onClick={() => void exportReport('daily', 'pdf', filters)}
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
              <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Cashier</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Transactions</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Local Total</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Foreign Total</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Grand Total</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Activities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {daily.map((row) => (
              <tr key={`${row.date}-${row.cashier_id}`}>
                <td className="px-3 py-2 text-slate-800">{row.date}</td>
                <td className="px-3 py-2 text-slate-800">{row.cashier_name}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.totals.total_transactions}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.totals.total_local_amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.totals.total_foreign_amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">
                  {row.totals.total_amount.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {row.activities.length === 0
                    ? '-'
                    : row.activities
                        .map((activity) => `${activity.activity_name} (L ${activity.local_count}, F ${activity.foreign_count})`)
                        .join(', ')}
                </td>
              </tr>
            ))}

            {!isLoading && daily.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No records found for selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        {isLoading ? 'Loading report…' : `Total records: ${total}`}
      </p>
    </div>
  );
}
