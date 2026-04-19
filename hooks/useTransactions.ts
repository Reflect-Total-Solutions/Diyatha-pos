'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTransactionGroupStore } from '@/stores/transactionGroup';
import type { PriceType, Transaction } from '@/types/transaction';

type GroupResponse = {
  id: string;
  cashier_id: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  transaction_count: number;
  total_amount: number;
  created_at: string;
};

type TransactionWithToken = Transaction & {
  token_number?: string | null;
};

type PaginatedApiResponse<T> = {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
};

type SingleApiResponse<T> = {
  data?: T;
  error?: string;
};

type MutationResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type UseTransactionsOptions = {
  page?: number;
  limit?: number;
  transactionGroupId?: string;
  includeCancelled?: boolean;
  autoFetch?: boolean;
  startDate?: string;
  endDate?: string;
};

export type CreateTransactionInput = {
  activity_id: string;
  price_type: PriceType;
  amount?: number;
  transaction_group_id?: string;
};

export type BulkTransactionItem = {
  activity_id: string;
  quantity: number;
  price_type: PriceType;
};

export type BulkTransactionResult = {
  transaction_group_id: string;
  transactions: TransactionWithToken[];
  transaction_count: number;
  total_amount: number;
};

export type TransactionSearchInput = {
  q?: string;
  token?: string;
  activityId?: string;
  cashierId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  include_cancelled?: boolean;
};

function buildListUrl(path: string, options: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    params.set(key, String(value));
  }

  return `${path}?${params.toString()}`;
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<TransactionWithToken[]>([]);
  const [isLoading, setIsLoading] = useState(options.autoFetch !== false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(options.page ?? 1);
  const [limit, setLimit] = useState(options.limit ?? 20);
  const [totalPages, setTotalPages] = useState(0);

  const currentGroupId = useTransactionGroupStore((state) => state.currentGroupId);
  const transactionCount = useTransactionGroupStore((state) => state.transactionCount);
  const groupTotalAmount = useTransactionGroupStore((state) => state.totalAmount);
  const startNewGroup = useTransactionGroupStore((state) => state.startNewGroup);
  const endGroup = useTransactionGroupStore((state) => state.endGroup);
  const setFromServer = useTransactionGroupStore((state) => state.setFromServer);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        buildListUrl('/api/transactions', {
          page: options.page ?? 1,
          limit: options.limit ?? 20,
          transaction_group_id: options.transactionGroupId,
          include_cancelled: options.includeCancelled,
          start_date: options.startDate,
          end_date: options.endDate,
        }),
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const payload = (await response.json()) as PaginatedApiResponse<TransactionWithToken>;

      if (!response.ok) {
        setTransactions([]);
        setError(payload.error ?? 'Unable to load transactions');
        return;
      }

      setTransactions(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? 1);
      setLimit(payload.limit ?? 20);
      setTotalPages(payload.totalPages ?? 0);
    } catch {
      setTransactions([]);
      setError('Unable to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [options.includeCancelled, options.limit, options.page, options.transactionGroupId, options.startDate, options.endDate]);

  useEffect(() => {
    if (options.autoFetch === false) {
      return;
    }

    void loadTransactions();
  }, [loadTransactions, options.autoFetch]);

  const startGroup = useCallback(async (notes?: string): Promise<MutationResult<GroupResponse>> => {
    setIsMutating(true);

    try {
      const response = await fetch('/api/transaction-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      const payload = (await response.json()) as SingleApiResponse<GroupResponse>;

      if (!response.ok || !payload.data) {
        return {
          success: false,
          error: payload.error ?? 'Failed to start transaction group',
        };
      }

      startNewGroup(payload.data.id, payload.data.started_at);
      setFromServer({
        id: payload.data.id,
        created_at: payload.data.started_at,
        transaction_count: payload.data.transaction_count,
        total_amount: payload.data.total_amount,
      });

      return {
        success: true,
        data: payload.data,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to start transaction group',
      };
    } finally {
      setIsMutating(false);
    }
  }, [setFromServer, startNewGroup]);

  const endCurrentGroup = useCallback(async (): Promise<MutationResult<GroupResponse>> => {
    if (!currentGroupId) {
      return {
        success: false,
        error: 'No active transaction group',
      };
    }

    setIsMutating(true);

    try {
      const response = await fetch('/api/transaction-groups', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ group_id: currentGroupId }),
      });

      const payload = (await response.json()) as SingleApiResponse<GroupResponse>;

      if (!response.ok || !payload.data) {
        return {
          success: false,
          error: payload.error ?? 'Failed to close transaction group',
        };
      }

      endGroup();
      return {
        success: true,
        data: payload.data,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to close transaction group',
      };
    } finally {
      setIsMutating(false);
    }
  }, [currentGroupId, endGroup]);

  const createTransaction = useCallback(async (
    input: CreateTransactionInput
  ): Promise<MutationResult<TransactionWithToken>> => {
    setIsMutating(true);

    try {
      const latestGroupId = useTransactionGroupStore.getState().currentGroupId;
      let targetGroupId = input.transaction_group_id ?? latestGroupId ?? currentGroupId;

      if (!targetGroupId) {
        const groupResult = await startGroup();

        if (!groupResult.success || !groupResult.data) {
          return {
            success: false,
            error: groupResult.error ?? 'Failed to initialize transaction group',
          };
        }

        targetGroupId = groupResult.data.id;
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_group_id: targetGroupId,
          activity_id: input.activity_id,
          price_type: input.price_type,
          amount: input.amount ?? 0,
        }),
      });

      const payload = (await response.json()) as SingleApiResponse<TransactionWithToken>;

      if (!response.ok || !payload.data) {
        return {
          success: false,
          error: payload.error ?? 'Failed to create transaction',
        };
      }

      if (targetGroupId) {
        const nextCount = transactionCount + 1;
        const nextAmount = Number((groupTotalAmount + payload.data.amount).toFixed(2));

        setFromServer({
          id: targetGroupId,
          transaction_count: nextCount,
          total_amount: nextAmount,
        });
      }

      return {
        success: true,
        data: payload.data,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to create transaction',
      };
    } finally {
      setIsMutating(false);
    }
  }, [currentGroupId, groupTotalAmount, setFromServer, startGroup, transactionCount]);

  const createBulkTransactions = useCallback(async (
    items: BulkTransactionItem[],
    paymentMethod: 'cash' | 'card',
    groupId?: string
  ): Promise<MutationResult<BulkTransactionResult>> => {
    setIsMutating(true);

    try {
      const latestGroupId = useTransactionGroupStore.getState().currentGroupId;
      const targetGroupId = groupId ?? latestGroupId ?? currentGroupId ?? undefined;

      const response = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_group_id: targetGroupId,
          payment_method: paymentMethod,
          items,
        }),
      });

      const payload = (await response.json()) as SingleApiResponse<BulkTransactionResult>;

      if (!response.ok || !payload.data) {
        return {
          success: false,
          error: payload.error ?? 'Failed to create transactions',
        };
      }

      // Update the group store with the real server values
      setFromServer({
        id: payload.data.transaction_group_id,
        transaction_count: payload.data.transaction_count,
        total_amount: payload.data.total_amount,
      });

      // If no group existed before, also trigger startNewGroup for UI
      if (!targetGroupId) {
        startNewGroup(payload.data.transaction_group_id);
      }

      return {
        success: true,
        data: payload.data,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to create transactions',
      };
    } finally {
      setIsMutating(false);
    }
  }, [currentGroupId, setFromServer, startNewGroup]);

  const cancelTransaction = useCallback(async (
    transactionId: string,
    reason?: string,
    cancelCode?: string
  ): Promise<MutationResult<TransactionWithToken>> => {
    setIsMutating(true);

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel', reason, cancelCode }),
      });

      const payload = (await response.json()) as SingleApiResponse<TransactionWithToken>;

      if (!response.ok || !payload.data) {
        return {
          success: false,
          error: payload.error ?? 'Failed to cancel transaction',
        };
      }

      await loadTransactions();
      return {
        success: true,
        data: payload.data,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to cancel transaction',
      };
    } finally {
      setIsMutating(false);
    }
  }, [loadTransactions]);

  const searchTransactions = useCallback(async (
    input: TransactionSearchInput
  ): Promise<MutationResult<TransactionWithToken[]>> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        buildListUrl('/api/transactions/search', {
          q: input.q,
          token: input.token,
          activityId: input.activityId,
          cashierId: input.cashierId,
          startDate: input.startDate,
          endDate: input.endDate,
          page: input.page ?? 1,
          limit: input.limit ?? 20,
          include_cancelled: input.include_cancelled,
        }),
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const payload = (await response.json()) as PaginatedApiResponse<TransactionWithToken>;

      if (!response.ok) {
        setTransactions([]);
        setError(payload.error ?? 'Unable to search transactions');

        return {
          success: false,
          error: payload.error ?? 'Unable to search transactions',
        };
      }

      setTransactions(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? 1);
      setLimit(payload.limit ?? 20);
      setTotalPages(payload.totalPages ?? 0);

      return {
        success: true,
        data: payload.data ?? [],
      };
    } catch {
      setTransactions([]);
      setError('Unable to search transactions');

      return {
        success: false,
        error: 'Unable to search transactions',
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const summary = useMemo(
    () => ({
      total,
      page,
      limit,
      totalPages,
      transactionCount,
      groupTotalAmount,
      currentGroupId,
    }),
    [currentGroupId, groupTotalAmount, limit, page, total, totalPages, transactionCount]
  );

  return {
    transactions,
    summary,
    isLoading,
    isMutating,
    error,
    refetch: loadTransactions,
    startGroup,
    endCurrentGroup,
    createTransaction,
    createBulkTransactions,
    cancelTransaction,
    searchTransactions,
  };
}
