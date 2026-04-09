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
  items: Array<{
    activity: Activity;
    quantity: number;
    priceType: PriceType;
  }>;
  isSubmitting?: boolean;
  error?: string | null;
  onQuantityChange: (activityId: string, priceType: PriceType, quantity: number) => void;
  onRemoveItem: (activityId: string, priceType: PriceType) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function PaymentConfirmation({
  open,
  items,
  isSubmitting = false,
  error = null,
  onQuantityChange,
  onRemoveItem,
  onCancel,
  onConfirm,
}: PaymentConfirmationProps) {
  if (!open || items.length === 0) {
    return null;
  }

  const totalAmount = items.reduce((sum, item) => {
    const unitAmount = item.priceType === 'local' ? item.activity.local_price : item.activity.foreign_price;
    return sum + unitAmount * Math.max(1, item.quantity);
  }, 0);

  const totalTickets = items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Payment Confirmation
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Confirm Ticket Purchase</h2>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Activity</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Unit</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Line Total</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const unitAmount =
                  item.priceType === 'local' ? item.activity.local_price : item.activity.foreign_price;
                const lineTotal = unitAmount * Math.max(1, item.quantity);

                return (
                  <tr key={`${item.activity.id}-${item.priceType}`}>
                    <td className="px-3 py-2 text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{item.activity.name}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          {item.priceType}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-800">{formatCurrency(unitAmount)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={item.quantity}
                        disabled={isSubmitting}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          onQuantityChange(
                            item.activity.id,
                            item.priceType,
                            Number.isFinite(parsed) ? Math.max(1, parsed) : 1
                          );
                        }}
                        className="h-9 w-20 rounded-md border border-slate-300 px-2 text-right text-sm text-slate-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(lineTotal)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onRemoveItem(item.activity.id, item.priceType)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div>
              <span className="font-medium">Selected Tickets:</span>{' '}
              {totalTickets}
            </div>
            <div className="ml-auto text-lg font-semibold text-slate-900">{formatCurrency(totalAmount)}</div>
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
