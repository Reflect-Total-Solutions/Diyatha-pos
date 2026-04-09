'use client';

import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { usePriceModeStore } from '@/stores/priceMode';
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

type ActivityButtonProps = {
  activity: Activity;
  onSelect?: (activity: Activity) => void;
  priceType?: PriceType;
  disabled?: boolean;
};

export default function ActivityButton({
  activity,
  onSelect,
  priceType,
  disabled = false,
}: ActivityButtonProps) {
  const storePriceType = usePriceModeStore((state) => state.priceType);
  const selectedPriceType = priceType ?? storePriceType;

  const selectedPrice = useMemo(
    () => (selectedPriceType === 'local' ? activity.local_price : activity.foreign_price),
    [activity.foreign_price, activity.local_price, selectedPriceType]
  );

  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full flex-col items-start gap-2 rounded-xl border-slate-200 px-4 py-4 text-left hover:border-slate-300 hover:bg-slate-50"
      disabled={disabled || !activity.is_active}
      onClick={() => onSelect?.(activity)}
    >
      <div className="w-full">
        <p className="truncate text-sm font-semibold text-slate-900">{activity.name}</p>
        {activity.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{activity.description}</p>
        ) : null}
      </div>

      <div className="flex w-full items-center justify-between text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
          {selectedPriceType}
        </span>
        <span className="font-semibold text-slate-800">{formatCurrency(selectedPrice)}</span>
      </div>
    </Button>
  );
}
