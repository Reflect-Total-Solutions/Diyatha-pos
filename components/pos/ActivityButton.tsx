'use client';

import Image from 'next/image';
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
      className="h-auto w-full flex-col items-start gap-4 rounded-xl border-slate-200 px-4 py-4 text-left hover:border-slate-300 hover:bg-slate-50 relative overflow-hidden"
      disabled={disabled || !activity.is_active}
      onClick={() => onSelect?.(activity)}
    >
      <div className="flex w-full items-start gap-3">
        {activity.image_url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <Image
              src={activity.image_url}
              alt={activity.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="w-full flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-slate-900">{activity.name}</p>
          {activity.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{activity.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-between text-xs mt-auto pt-2 border-t border-slate-100">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium uppercase tracking-wide text-slate-600">
          {selectedPriceType}
        </span>
        <span className="font-semibold text-slate-800">{formatCurrency(selectedPrice)}</span>
      </div>
    </Button>
  );
}
