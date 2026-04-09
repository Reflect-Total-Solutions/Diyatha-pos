/**
 * Printer Type Definition
 * Represents printer discovery and status
 */

export interface PrinterStatus {
  ip: string;
  port: number;
  model?: string | null;
  is_online: boolean;
  last_checked_at: string;
  error_message?: string | null;
}

export interface DiscoveredPrinter {
  ip: string;
  port: number;
  model?: string;
  responseTime?: number;
}

export interface PrintRequest {
  transaction_id: string;
}

export interface PrintResponse {
  success: boolean;
  message: string;
  token_number?: string;
  token_index?: number;
  token_total?: number;
  printed_at?: string;
  error?: string;
}

export interface PrinterDiscoveryResult {
  printers: DiscoveredPrinter[];
  primary?: DiscoveredPrinter;
}
