'use client';

import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';
import type { PriceType } from '@/types/transaction';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type PaymentConfirmationProps = {
  open: boolean;
  activity: Activity | null;
  priceType: PriceType;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function PaymentConfirmation({
  open,
  activity,
  priceType,
  isSubmitting = false,
  error = null,
  onCancel,
  onConfirm,
}: PaymentConfirmationProps) {
  if (!open || !activity) {
    return null;
  }

  const amount = priceType === 'local' ? activity.local_price : activity.foreign_price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Payment Confirmation
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Confirm Ticket Purchase</h2>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">Activity</span>
            <span className="font-medium text-slate-900">{activity.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">Price Type</span>
            <span className="font-medium uppercase text-slate-900">{priceType}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-sm">
            <span className="text-slate-500">Amount</span>
            <span className="text-lg font-semibold text-slate-900">{formatCurrency(amount)}</span>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
