'use client';

import { useEffect, useMemo, useState } from 'react';

import { formatInTimeZone } from 'date-fns-tz';
import { Button } from '@/components/ui/button';
import { formatColomboDate } from '@/lib/dateUtils';
import { useReports } from '@/hooks/useReports';

function getTodayDateValue(): string {
  return formatInTimeZone(new Date(), 'Asia/Colombo', 'yyyy-MM-dd');
}

export default function ShiftReportPage() {
  const {
    shift,
    shiftTotalAmount,
    shiftWindow,
    total,
    isLoading,
    isExporting,
    error,
    loadShiftReport,
    exportReport,
  } = useReports();

  const [from, setFrom] = useState<string>(getTodayDateValue());
  const [to, setTo] = useState<string>(getTodayDateValue());
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('02:00');

  // Display-only pagination: the full window is always loaded so the grand
  // total and exports cover everything; only the table view is sliced.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const baseFilters = useMemo(
    () => ({
      from,
      to,
      startTime,
      endTime,
    }),
    [endTime, from, startTime, to]
  );

  useEffect(() => {
    void loadShiftReport(baseFilters);
  }, [baseFilters, loadShiftReport]);

  const totalPages = Math.max(1, Math.ceil(shift.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const visibleRows = useMemo(
    () => shift.slice((safePage - 1) * pageSize, safePage * pageSize),
    [pageSize, safePage, shift]
  );

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Shift Report</h2>
          <p className="mt-1 text-sm text-slate-600">
            Business-day report: pick the date(s) and the operating hours (default 4:00 PM to 2:00 AM next
            morning). Times are Sri Lanka time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            From Date
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            To Date
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Start Time
            <input
              type="time"
              value={startTime}
              onChange={(event) => {
                setPage(1);
                setStartTime(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            End Time
            <input
              type="time"
              value={endTime}
              onChange={(event) => {
                setPage(1);
                setEndTime(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Page Size
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        {shiftWindow ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Window: <span className="font-semibold">{shiftWindow.start_local}</span> →{' '}
            <span className="font-semibold">{shiftWindow.end_local}</span> (Sri Lanka time)
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadShiftReport(baseFilters)}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void exportReport('shift', 'xlsx', baseFilters)}
            disabled={isExporting || isLoading}
          >
            Export XLSX
          </Button>

          <Button
            type="button"
            onClick={() => void exportReport('shift', 'pdf', baseFilters)}
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

      {total > shift.length ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Showing {shift.length} of {total} transactions — the window is too large. Narrow the date or time
          range so the totals cover everything.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Created</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Reference</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Cashier</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Activity</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Price Type</th>
              <th className="px-3 py-2 text-right font-medium text-slate-600">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.map((row) => (
              <tr key={row.id} className={row.cancelled_at ? 'bg-red-50/50' : undefined}>
                <td className="px-3 py-2 text-slate-800">
                  {formatColomboDate(new Date(row.created_at), 'dd-MM-yyyy hh:mm:ss a')}
                </td>
                <td className="px-3 py-2 text-slate-800">{row.txn_reference}</td>
                <td className="px-3 py-2 text-slate-800">{row.cashier_name}</td>
                <td className="px-3 py-2 text-slate-800">{row.activity_name}</td>
                <td className="px-3 py-2 text-slate-800">{row.price_type}</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    row.cancelled_at ? 'text-red-600 line-through' : 'text-slate-900'
                  }`}
                >
                  {row.amount.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {row.cancelled_at ? (
                    <span className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                      Cancelled
                    </span>
                  ) : (
                    <span className="rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {!isLoading && shift.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No transactions in this window.
                </td>
              </tr>
            ) : null}
          </tbody>
          {shift.length > 0 ? (
            <tfoot className="bg-slate-900">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-bold uppercase tracking-wide text-white">
                  Grand Total (excl. cancelled)
                </td>
                <td className="px-3 py-2 text-right text-base font-bold text-yellow-400">
                  {shiftTotalAmount.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">{total} rows</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          {isLoading
            ? 'Loading report…'
            : `Showing page ${safePage} of ${totalPages}. Total transactions in window: ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={isLoading || safePage <= 1}
          >
            Previous
          </Button>

          <Button
            type="button"
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={isLoading || safePage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
