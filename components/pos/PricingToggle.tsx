'use client';

import { Button } from '@/components/ui/button';
import type { PriceType } from '@/types/transaction';

type PricingToggleProps = {
  value: PriceType;
  onChange: (value: PriceType) => void;
  disabled?: boolean;
};

export default function PricingToggle({ value, onChange, disabled = false }: PricingToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <Button
        type="button"
        size="sm"
        variant={value === 'local' ? 'default' : 'ghost'}
        disabled={disabled}
        className="min-w-28"
        onClick={() => onChange('local')}
      >
        Local
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === 'foreign' ? 'default' : 'ghost'}
        disabled={disabled}
        className="min-w-28"
        onClick={() => onChange('foreign')}
      >
        Foreign
      </Button>
    </div>
  );
}
