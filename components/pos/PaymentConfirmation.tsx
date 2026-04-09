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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border-3 border-slate-400 bg-white p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
          ✓ Payment Confirmation
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Confirm Ticket Purchase</h2>

        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-50">
          <table className="w-full divide-y-2 divide-slate-300">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-white text-sm">Activity</th>
                <th className="px-4 py-3 text-right font-bold text-white text-sm">Unit</th>
                <th className="px-4 py-3 text-right font-bold text-white text-sm">Qty</th>
                <th className="px-4 py-3 text-right font-bold text-white text-sm">Total</th>
                <th className="px-4 py-3 text-right font-bold text-white text-sm">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 bg-white">
              {items.map((item) => {
                const unitAmount =
                  item.priceType === 'local' ? item.activity.local_price : item.activity.foreign_price;
                const lineTotal = unitAmount * Math.max(1, item.quantity);

                return (
                  <tr key={`${item.activity.id}-${item.priceType}`}>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-semibold text-sm">{item.activity.name}</span>
                        <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase text-slate-700 border border-slate-300">
                          {item.priceType}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-semibold">{formatCurrency(unitAmount)}</td>
                    <td className="px-4 py-3 text-right">
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
                        className="h-12 w-20 rounded-lg border-2 border-slate-300 px-2 text-right text-lg font-bold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 text-lg">{formatCurrency(lineTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onRemoveItem(item.activity.id, item.priceType)}
                        className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-red-400 bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100 hover:border-red-500 disabled:opacity-50 transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center gap-4 border-t-2 border-slate-300 bg-slate-900 px-4 py-4">
            <div className="text-sm font-bold text-white uppercase tracking-wide">
              <span>Selected Tickets:</span>{' '}
              <span className="text-2xl text-yellow-400 font-bold ml-2">{totalTickets}</span>
            </div>
            <div className="ml-auto text-3xl font-bold text-yellow-400">{formatCurrency(totalAmount)}</div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
            className="h-14 rounded-xl border-2 border-slate-400 bg-slate-100 px-6 text-lg font-bold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            className="h-14 rounded-xl border-2 border-green-600 bg-green-600 px-8 text-lg font-bold text-white hover:bg-green-700 transition-colors"
            onClick={onConfirm}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
