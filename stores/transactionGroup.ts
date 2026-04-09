import { create } from 'zustand';

interface TransactionGroupState {
  currentGroupId: string | null;
  createdAt: string | null;
  transactionCount: number;
  totalAmount: number;
  startNewGroup: (groupId: string, startedAt?: string) => void;
  endGroup: () => void;
  increment: (amount: number) => void;
  setFromServer: (input: {
    id: string;
    created_at?: string;
    transaction_count: number;
    total_amount: number;
  }) => void;
  getItemCount: () => number;
}

export const useTransactionGroupStore = create<TransactionGroupState>((set, get) => ({
  currentGroupId: null,
  createdAt: null,
  transactionCount: 0,
  totalAmount: 0,
  startNewGroup: (groupId, startedAt) =>
    set({
      currentGroupId: groupId,
      createdAt: startedAt ?? new Date().toISOString(),
      transactionCount: 0,
      totalAmount: 0,
    }),
  endGroup: () =>
    set({
      currentGroupId: null,
      createdAt: null,
      transactionCount: 0,
      totalAmount: 0,
    }),
  increment: (amount) =>
    set((state) => ({
      transactionCount: state.transactionCount + 1,
      totalAmount: Number((state.totalAmount + amount).toFixed(2)),
    })),
  setFromServer: (input) =>
    set({
      currentGroupId: input.id,
      createdAt: input.created_at ?? new Date().toISOString(),
      transactionCount: input.transaction_count,
      totalAmount: Number(input.total_amount.toFixed(2)),
    }),
  getItemCount: () => get().transactionCount,
}));
