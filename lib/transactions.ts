import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];
type TokenRow = Database['public']['Tables']['tokens']['Row'];

export type GroupStats = {
  transaction_count: number;
  total_amount: number;
};

type RouteSupabaseClient = SupabaseClient<Database>;

export async function getActiveTransactionsInGroup(
  supabase: RouteSupabaseClient,
  groupId: string
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_group_id', groupId)
    .is('cancelled_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as TransactionRow[];
}

export async function resequenceGroupTransactions(
  supabase: RouteSupabaseClient,
  groupId: string
): Promise<{
  transactions: TransactionRow[];
  total: number;
}> {
  const activeTransactions = await getActiveTransactionsInGroup(supabase, groupId);
  const total = activeTransactions.length;

  for (let index = 0; index < activeTransactions.length; index += 1) {
    const transaction = activeTransactions[index];

    await supabase
      .from('transactions')
      .update(
        {
          token_index: index + 1,
          token_total: total,
        } as never
      )
      .eq('id', transaction.id);
  }

  if (activeTransactions.length > 0) {
    const transactionIds = activeTransactions.map((transaction) => transaction.id);

    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .in('transaction_id', transactionIds);

    if (tokenError) {
      throw tokenError;
    }

    const tokenRows = (tokenData ?? []) as unknown as TokenRow[];

    for (let index = 0; index < activeTransactions.length; index += 1) {
      const transaction = activeTransactions[index];
      const token = tokenRows.find((row) => row.transaction_id === transaction.id);

      if (!token) {
        continue;
      }

      await supabase
        .from('tokens')
        .update(
          {
            token_index: index + 1,
            token_total: total,
          } as never
        )
        .eq('id', token.id);
    }
  }

  return {
    transactions: activeTransactions,
    total,
  };
}

export async function getTransactionGroupStats(
  supabase: RouteSupabaseClient,
  groupIds: string[]
): Promise<Map<string, GroupStats>> {
  const result = new Map<string, GroupStats>();

  if (groupIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('transaction_group_id, amount, cancelled_at')
    .in('transaction_group_id', groupIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{
    transaction_group_id: string;
    amount: number;
    cancelled_at: string | null;
  }>;

  for (const groupId of groupIds) {
    result.set(groupId, {
      transaction_count: 0,
      total_amount: 0,
    });
  }

  for (const row of rows) {
    if (row.cancelled_at) {
      continue;
    }

    const current = result.get(row.transaction_group_id) ?? {
      transaction_count: 0,
      total_amount: 0,
    };

    result.set(row.transaction_group_id, {
      transaction_count: current.transaction_count + 1,
      total_amount: Number((current.total_amount + row.amount).toFixed(2)),
    });
  }

  return result;
}
