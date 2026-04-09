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
      className="group h-auto w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-300 bg-white px-3 py-6 text-center transition-all duration-200 hover:border-slate-400 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={disabled || !activity.is_active}
      onClick={() => onSelect?.(activity)}
    >
      <div className="relative w-full">
        {activity.image_url ? (
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100">
            <Image
              src={activity.image_url}
              alt={activity.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform"
              sizes="96px"
            />
          </div>
        ) : (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-xl border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <svg
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">{activity.name}</p>
      </div>

      <div className="w-full space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 border border-slate-300">
            {selectedPriceType}
          </span>
        </div>
        <div className="text-lg font-bold text-emerald-600">{formatCurrency(selectedPrice)}</div>
      </div>
    </Button>
  );
}

