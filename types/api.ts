/**
 * API Type Definitions
 * Shared response/request types for all API endpoints
 */

/**
 * Generic API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

/**
 * API Error details
 */
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Transaction Group response
 */
export interface TransactionGroupResponse {
  id: string;
  cashier_id: string;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
  transaction_count: number;
  total_amount: number;
  created_at: string;
}

/**
 * Daily Summary Report
 */
export interface DailySummaryReport {
  date: string; // DD-MM-YYYY
  cashier_id: string;
  cashier_name: string;
  activities: {
    activity_id: string;
    activity_name: string;
    local_count: number;
    local_total: number;
    foreign_count: number;
    foreign_total: number;
  }[];
  totals: {
    total_transactions: number;
    total_local_amount: number;
    total_foreign_amount: number;
    total_amount: number;
  };
}

/**
 * Transaction search result
 */
export interface TransactionSearchResult {
  id: string;
  token_number: string;
  activity_name: string;
  cashier_name: string;
  amount: number;
  price_type: 'local' | 'foreign';
  print_status: 'pending' | 'printed' | 'failed';
  created_at: string;
  cancelled_at?: string | null;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    latency_ms?: number;
  };
  printer: {
    discovered: boolean;
    online: boolean;
    ip?: string;
    port?: number;
    last_checked?: string;
  };
  timestamp: string;
}
