/**
 * Transaction Type Definition
 * Represents a single activity purchase (one bill = one activity)
 */

export type PriceType = 'local' | 'foreign';
export type PrintStatus = 'pending' | 'printed' | 'failed';

export interface Transaction {
  id: string;
  transaction_group_id: string;
  cashier_id: string;
  activity_id: string;
  price_type: PriceType;
  amount: number;
  token_index?: number | null;
  token_total?: number | null;
  txn_reference: string;
  print_status: PrintStatus;
  printed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateTransactionRequest = Pick<
  Transaction,
  'transaction_group_id' | 'activity_id' | 'price_type' | 'amount'
>;

export type CreateTransactionResponse = Transaction;

export interface TransactionSearchParams {
  startDate?: string;
  endDate?: string;
  token?: string;
  activityId?: string;
  cashierId?: string;
  limit?: number;
  offset?: number;
}
