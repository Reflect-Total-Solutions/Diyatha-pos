'use client';

import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';
import type { Transaction } from '@/types/transaction';

type TransactionHistoryItem = Transaction & {
  token_number?: string | null;
};

type TransactionHistoryProps = {
  transactions: TransactionHistoryItem[];
  activitiesById: Map<string, Activity>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onCancelTransaction: (transactionId: string) => void;
  cancellingTransactionId?: string | null;
  isLoading?: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-LK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
}

export default function TransactionHistory({
  transactions,
  activitiesById,
  searchQuery,
  onSearchQueryChange,
  onCancelTransaction,
  cancellingTransactionId = null,
  isLoading = false,
}: TransactionHistoryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
          <p className="text-xs text-slate-500">Search by token, activity, or reference</p>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search token or reference"
          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500 sm:w-64"
        />
      </div>

      <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Token</th>
              <th className="px-3 py-2 text-left font-semibold">Activity</th>
              <th className="px-3 py-2 text-left font-semibold">Amount</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Time</th>
              <th className="px-3 py-2 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const activity = activitiesById.get(transaction.activity_id);

                return (
                  <tr key={transaction.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {transaction.token_number ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {activity?.name ?? transaction.activity_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatCurrency(transaction.amount)}</td>
                    <td className="px-3 py-2">
                      {transaction.cancelled_at ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Cancelled
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatTime(transaction.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={Boolean(transaction.cancelled_at) || cancellingTransactionId === transaction.id}
                        onClick={() => onCancelTransaction(transaction.id)}
                      >
                        {cancellingTransactionId === transaction.id ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
