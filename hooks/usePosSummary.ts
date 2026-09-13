'use client';

import { useCallback, useEffect, useState } from 'react';

export type PosDailySummary = {
  total_count: number;
  local_count: number;
  foreign_count: number;
  cancelled_count: number;
  local_amount: number;
  foreign_amount: number;
  cash_amount: number;
  card_amount: number;
  total_amount: number;
};

const EMPTY_SUMMARY: PosDailySummary = {
  total_count: 0,
  local_count: 0,
  foreign_count: 0,
  cancelled_count: 0,
  local_amount: 0,
  foreign_amount: 0,
  cash_amount: 0,
  card_amount: 0,
  total_amount: 0,
};

type UsePosSummaryOptions = {
  startDate: string;
  endDate: string;
  autoFetch?: boolean;
};

/**
 * Loads the server-computed daily summary (gross total, counts, cash/card) for
 * the current cashier via the get_pos_daily_summary RPC. This replaces summing
 * the full day's transaction rows in the browser.
 */
export function usePosSummary(options: UsePosSummaryOptions) {
  const { startDate, endDate, autoFetch = true } = options;
  const [summary, setSummary] = useState<PosDailySummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(autoFetch);

  const refetch = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      const response = await fetch(`/api/transactions/summary?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as { data?: PosDailySummary; error?: string };

      if (!response.ok || !payload.data) {
        setSummary(EMPTY_SUMMARY);
        return;
      }

      setSummary(payload.data);
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!autoFetch) {
      return;
    }

    void refetch();
  }, [autoFetch, refetch]);

  return { summary, isLoading, refetch };
}
