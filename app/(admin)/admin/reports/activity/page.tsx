'use client';

import { useEffect, useMemo, useState } from 'react';

import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { useReports } from '@/hooks/useReports';

function getTodayDateValue(): string {
  return formatInTimeZone(new Date(), 'Asia/Colombo', 'yyyy-MM-dd');
}

export default function ActivityReportPage() {
  const {
    activity,
    total,
    isLoading,
    isExporting,
    error,
    loadActivityReport,
    exportReport,
  } = useReports();

  const [from, setFrom] = useState<string>(getTodayDateValue());
  const [to, setTo] = useState<string>(getTodayDateValue());
  const [activityId, setActivityId] = useState('');

  const filters = useMemo(
    () => ({
      from,
      to,
      activityId: activityId || undefined,
    }),
    [activityId, from, to]
  );

  useEffect(() => {
    void loadActivityReport(filters);
  }, [filters, loadActivityReport]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Activity Report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Revenue and count distribution by activity.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
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
            Activity ID (optional)
            <input
              type="text"
              value={activityId}
              onChange={(event) => setActivityId(event.target.value)}
              placeholder="UUID"
              className="h-9 w-44 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadActivityReport(filters)}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void exportReport('activity', 'xlsx', filters)}
            disabled={isExporting || isLoading}
          >
            Export XLSX
          </Button>

          <Button
            type="button"
            onClick={() => void exportReport('activity', 'pdf', filters)}
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
              <th className="px-3 py-2 text-left font-medium text-slate-600">Activity</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Local Count</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Foreign Count</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Total Count</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Local Total</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Foreign Total</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Grand Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {activity.map((row) => (
              <tr key={row.activity_id}>
                <td className="px-3 py-2 text-slate-800">{row.activity_name}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.local_count}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.foreign_count}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.total_count}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.local_total.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-slate-800">{row.foreign_total.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">
                  {row.total_amount.toFixed(2)}
                </td>
              </tr>
            ))}

            {!isLoading && activity.length === 0 ? (
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
