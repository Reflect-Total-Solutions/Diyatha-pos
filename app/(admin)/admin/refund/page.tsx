'use client';

import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

import { Button } from '@/components/ui/button';

type RefundTicket = {
  token_number: string;
  token_index: number;
  token_total: number;
  transaction_id: string;
  txn_reference: string;
  activity_name: string;
  amount: number;
  price_type: 'local' | 'foreign';
  payment_method: string;
  cashier_name: string;
  created_at: string;
  status: 'active' | 'cancelled';
  exchanged: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getTodayDateValue(): string {
  return formatInTimeZone(new Date(), 'Asia/Colombo', 'yyyy-MM-dd');
}

export default function AdminRefundPage() {
  const [date, setDate] = useState<string>(getTodayDateValue());
  const [tokenNumber, setTokenNumber] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<RefundTicket | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedToken = tokenNumber.trim();
    if (!trimmedToken || !date) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setNotice(null);
    setResult(null);
    setReason('');

    try {
      const params = new URLSearchParams({ token: trimmedToken, date });
      const response = await fetch(`/api/admin/refund?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as { data?: RefundTicket; error?: string };

      if (!response.ok || !payload.data) {
        setError(payload.error ?? 'Unable to search for the token.');
        return;
      }

      setResult(payload.data);
    } catch {
      setError('Unable to search for the token.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleRefund() {
    if (!result || isRefunding) {
      return;
    }

    const confirmed = window.confirm(
      `Refund and permanently remove token ${result.token_number}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setIsRefunding(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          token_number: result.token_number,
          date,
          reason: reason.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        data?: { token_number: string };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setError(payload.error ?? 'Refund failed.');
        return;
      }

      setNotice(`Token ${payload.data.token_number} was refunded and permanently removed.`);
      setResult(null);
      setReason('');
      setTokenNumber('');
    } catch {
      setError('Refund failed.');
    } finally {
      setIsRefunding(false);
    }
  }

  return (
    <div className="max-w-[900px]">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Refund</h2>
        <p className="mt-1 text-sm text-slate-600">
          Search a ticket token by date and token number, then permanently remove it from the system.
        </p>
      </div>

      {notice ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSearch}
        className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Ticket Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-900"
              disabled={isSearching || isRefunding}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Token Number
            <input
              type="text"
              value={tokenNumber}
              onChange={(event) => setTokenNumber(event.target.value)}
              placeholder="CWPCCMB-YYYYMMDD-XXXX"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
              disabled={isSearching || isRefunding}
            />
          </label>

          <Button
            type="submit"
            disabled={isSearching || isRefunding || !tokenNumber.trim() || !date}
            className="h-10"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Token Details</h3>
            {result.status === 'cancelled' ? (
              <span className="rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-900">
                {result.exchanged ? 'Exchanged' : 'Cancelled'}
              </span>
            ) : (
              <span className="rounded-lg border-2 border-green-400 bg-green-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-900">
                Active
              </span>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Token Number</dt>
              <dd className="mt-0.5 font-bold text-slate-900">{result.token_number}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Transaction Ref</dt>
              <dd className="mt-0.5 font-semibold text-slate-800">{result.txn_reference}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Activity</dt>
              <dd className="mt-0.5 font-semibold text-slate-800">{result.activity_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount</dt>
              <dd className="mt-0.5 font-bold text-slate-900">{formatCurrency(result.amount)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Price Type</dt>
              <dd className="mt-0.5 capitalize text-slate-800">{result.price_type}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment Method</dt>
              <dd className="mt-0.5 capitalize text-slate-800">{result.payment_method}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Cashier</dt>
              <dd className="mt-0.5 text-slate-800">{result.cashier_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatInTimeZone(new Date(result.created_at), 'Asia/Colombo', 'dd-MM-yyyy hh:mm:ss a')}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Token Position</dt>
              <dd className="mt-0.5 text-slate-800">
                {result.token_index} of {result.token_total}
              </dd>
            </div>
          </dl>

          {result.status === 'cancelled' ? (
            <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This ticket is already cancelled{result.exchanged ? ' (exchanged)' : ''} and cannot be refunded.
            </p>
          ) : (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Refund reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Customer requested refund"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                disabled={isRefunding}
              />

              <p className="mt-3 text-sm font-semibold text-red-700">
                This permanently removes the token from the system. It cannot be undone.
              </p>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  onClick={handleRefund}
                  disabled={isRefunding}
                  className="bg-red-600 font-bold text-white hover:bg-red-700"
                >
                  {isRefunding ? 'Refunding...' : 'Refund / Remove Token'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
