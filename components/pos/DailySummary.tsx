'use client';

import { useMemo } from 'react';

import type { Transaction } from '@/types/transaction';

type TransactionSummaryItem = Transaction & {
  token_number?: string | null;
};

type DailySummaryProps = {
  transactions: TransactionSummaryItem[];
  activeGroupId: string | null;
  activeGroupCount: number;
  activeGroupAmount: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function DailySummary({
  transactions,
  activeGroupId,
  activeGroupCount,
  activeGroupAmount,
}: DailySummaryProps) {
  const summary = useMemo(() => {
    let totalCount = 0;
    let localCount = 0;
    let foreignCount = 0;
    let cancelledCount = 0;
    let localAmount = 0;
    let foreignAmount = 0;

    for (const transaction of transactions) {
      if (transaction.cancelled_at) {
        cancelledCount += 1;
        continue;
      }

      totalCount += 1;

      if (transaction.price_type === 'local') {
        localCount += 1;
        localAmount += transaction.amount;
      } else {
        foreignCount += 1;
        foreignAmount += transaction.amount;
      }
    }

    const totalAmount = Number((localAmount + foreignAmount).toFixed(2));

    return {
      totalCount,
      localCount,
      foreignCount,
      cancelledCount,
      localAmount: Number(localAmount.toFixed(2)),
      foreignAmount: Number(foreignAmount.toFixed(2)),
      totalAmount,
    };
  }, [transactions]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Daily Summary</h2>
          <p className="text-xs text-slate-500">Based on current loaded transactions</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Active Group</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {activeGroupId ? `${activeGroupCount} items` : 'No open group'}
          </p>
          <p className="text-xs text-slate-600">{formatCurrency(activeGroupAmount)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tickets</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Local</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.localCount}</p>
          <p className="text-xs text-slate-500">{formatCurrency(summary.localAmount)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Foreign</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.foreignCount}</p>
          <p className="text-xs text-slate-500">{formatCurrency(summary.foreignAmount)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Cancelled</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{summary.cancelledCount}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-slate-50">
        <p className="text-xs uppercase tracking-wide text-slate-300">Gross Total</p>
        <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.totalAmount)}</p>
      </div>
    </section>
  );
}
