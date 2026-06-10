export type ReportDateFilters = {
  date?: string;
  from?: string;
  to?: string;
};

export interface DailyActivityBreakdown {
  activity_id: string;
  activity_name: string;
  local_count: number;
  local_total: number;
  foreign_count: number;
  foreign_total: number;
}

export interface DailyReportRow {
  date: string;
  cashier_id: string;
  cashier_name: string;
  activities: DailyActivityBreakdown[];
  totals: {
    total_transactions: number;
    total_local_amount: number;
    total_foreign_amount: number;
    total_cash_amount: number;
    total_card_amount: number;
    total_amount: number;
  };
}

export interface ActivityReportRow {
  activity_id: string;
  activity_name: string;
  local_count: number;
  foreign_count: number;
  total_count: number;
  local_total: number;
  foreign_total: number;
  total_amount: number;
}

export interface CashierActivityBreakdown {
  activity_id: string;
  activity_name: string;
  local_count: number;
  local_total: number;
  foreign_count: number;
  foreign_total: number;
  cash_total: number;
  card_total: number;
  total_amount: number;
}

export interface CashierReportRow {
  cashier_id: string;
  cashier_name: string;
  local_count: number;
  foreign_count: number;
  total_transactions: number;
  local_total: number;
  foreign_total: number;
  cash_total: number;
  card_total: number;
  total_amount: number;
  activities: CashierActivityBreakdown[];
}

export interface ShiftReportRow {
  id: string;
  txn_reference: string;
  cashier_id: string;
  cashier_name: string;
  activity_id: string;
  activity_name: string;
  price_type: 'local' | 'foreign';
  amount: number;
  created_at: string;
  cancelled_at: string | null;
}

export interface ShiftReportWindow {
  start_utc: string;
  end_utc: string;
  start_local: string;
  end_local: string;
}

export interface TransactionReportRow {
  id: string;
  token_number: string | null;
  txn_reference: string;
  activity_id: string;
  activity_name: string;
  cashier_id: string;
  cashier_name: string;
  price_type: 'local' | 'foreign';
  amount: number;
  print_status: 'pending' | 'printed' | 'failed';
  created_at: string;
  cancelled_at: string | null;
  reprint_count: number;
}
