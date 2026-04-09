import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Activity } from '@/types/activity';
import type { PriceType } from '@/types/transaction';

interface PriceModeState {
  priceType: PriceType;
  setPriceType: (priceType: PriceType) => void;
  toggle: () => void;
  getPrice: (activity: Pick<Activity, 'local_price' | 'foreign_price'>) => number;
}

export const usePriceModeStore = create<PriceModeState>()(
  persist(
    (set, get) => ({
      priceType: 'local',
      setPriceType: (priceType) => set({ priceType }),
      toggle: () =>
        set((state) => ({
          priceType: state.priceType === 'local' ? 'foreign' : 'local',
        })),
      getPrice: (activity) =>
        get().priceType === 'local' ? activity.local_price : activity.foreign_price,
    }),
    {
      name: 'pc-price-mode',
    }
  )
);
