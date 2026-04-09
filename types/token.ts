/**
 * Token Type Definition
 * Represents a printed ticket token (one per transaction)
 */

export interface Token {
  id: string;
  transaction_id: string;
  token_number: string; // CWPCCMB-YYYYMMDD-XXXX
  reprint_count: number;
  first_reprinted_at?: string | null;
  latest_reprinted_at?: string | null;
  created_at: string;
}

export type CreateTokenRequest = Pick<Token, 'transaction_id' | 'token_number'>;

export interface TokenWithIndex extends Token {
  token_index: number;
  token_total: number;
}
