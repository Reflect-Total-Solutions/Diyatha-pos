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
    <div className="inline-flex gap-2 rounded-2xl border-2 border-slate-400 bg-slate-100 p-2 shadow-md">
      <Button
        type="button"
        size="lg"
        disabled={disabled}
        className={`min-w-32 h-11 text-lg font-bold rounded-xl transition-all ${
          value === 'local'
            ? 'bg-blue-600 text-white hover:bg-blue-700 border-2 border-blue-700'
            : 'bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-400'
        }`}
        onClick={() => onChange('local')}
      >
        🏠 Local
      </Button>
      <Button
        type="button"
        size="lg"
        disabled={disabled}
        className={`min-w-32 h-11 text-lg font-bold rounded-xl transition-all ${
          value === 'foreign'
            ? 'bg-green-600 text-white hover:bg-green-700 border-2 border-green-700'
            : 'bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-400'
        }`}
        onClick={() => onChange('foreign')}
      >
        🌍 Foreign
      </Button>
    </div>
  );
}
