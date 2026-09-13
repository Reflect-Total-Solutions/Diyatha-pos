"use client";

import type { PosDailySummary } from "@/hooks/usePosSummary";

type DailySummaryProps = {
  // Server-computed daily totals (see get_pos_daily_summary RPC). Replaces
  // summing the full day's transaction rows in the browser.
  summary: PosDailySummary;
  activeGroupId: string | null;
  activeGroupCount: number;
  activeGroupAmount: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function DailySummary({
  summary: serverSummary,
  activeGroupId,
  activeGroupCount,
  activeGroupAmount,
}: DailySummaryProps) {
  const summary = {
    totalCount: serverSummary.total_count,
    localCount: serverSummary.local_count,
    foreignCount: serverSummary.foreign_count,
    cancelledCount: serverSummary.cancelled_count,
    cashAmount: serverSummary.cash_amount,
    cardAmount: serverSummary.card_amount,
    localAmount: serverSummary.local_amount,
    foreignAmount: serverSummary.foreign_amount,
    totalAmount: serverSummary.total_amount,
  };

  return (
    <section className="rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Daily Summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            Based on current loaded transactions
          </p>
        </div>

        <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Active Group
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-900">
            {activeGroupId ? activeGroupCount : 0} items
          </p>
          <p className="mt-1 text-lg font-bold text-blue-800">
            {formatCurrency(activeGroupAmount)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Tickets
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {summary.totalCount}
          </p>
        </div>
        <div className="rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-green-100 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-green-700">
            Local
          </p>
          <p className="mt-2 text-2xl font-bold text-green-900">
            {summary.localCount}
          </p>
          <p className="mt-1 text-sm font-semibold text-green-800">
            {formatCurrency(summary.localAmount)}
          </p>
        </div>
        <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
            Foreign
          </p>
          <p className="mt-2 text-2xl font-bold text-orange-900">
            {summary.foreignCount}
          </p>
          <p className="mt-1 text-sm font-semibold text-orange-800">
            {formatCurrency(summary.foreignAmount)}
          </p>
        </div>
        <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-red-700">
            Cancelled
          </p>
          <p className="mt-2 text-2xl font-bold text-red-900">
            {summary.cancelledCount}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border-3 border-yellow-400 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white shadow-lg flex flex-col justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">
            Gross Total
          </p>
          <p className="mt-2 text-4xl font-bold text-yellow-400">
            {formatCurrency(summary.totalAmount)}
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-700">
          <div className="flex justify-between items-center text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1"><span>💵</span> Cash Total:</span>
            <span className="text-white text-base">{formatCurrency(summary.cashAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1"><span>💳</span> Card Total:</span>
            <span className="text-white text-base">{formatCurrency(summary.cardAmount)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
