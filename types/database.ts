/**
 * Database Types
 *
 * NOTE:
 * These baseline types align with Phase 1 migrations. Regenerate from Supabase
 * once migrations are applied in your target environment:
 * supabase gen types typescript --local > types/database.ts
 */

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			users: {
				Row: {
					id: string;
					email: string;
					role: 'cashier' | 'admin' | 'vendor';
					display_name: string;
					phone: string | null;
					is_active: boolean;
					failed_login_attempts: number;
					locked_until: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					email: string;
					role?: 'cashier' | 'admin' | 'vendor';
					display_name: string;
					phone?: string | null;
					is_active?: boolean;
					failed_login_attempts?: number;
					locked_until?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					role?: 'cashier' | 'admin' | 'vendor';
					display_name?: string;
					phone?: string | null;
					is_active?: boolean;
					failed_login_attempts?: number;
					locked_until?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			categories: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			activities: {
				Row: {
					id: string;
					name: string;
					description: string | null;
					category_id: string | null;
					image_url: string | null;
					vendor_id: string | null;
					local_price: number;
					foreign_price: number;
					is_active: boolean;
					display_order: number;
					created_at: string;
					updated_at: string;
					deleted_at: string | null;
				};
				Insert: {
					id?: string;
					name: string;
					description?: string | null;
					category_id?: string | null;
					image_url?: string | null;
					vendor_id?: string | null;
					local_price?: number;
					foreign_price?: number;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Update: {
					id?: string;
					name?: string;
					description?: string | null;
					category_id?: string | null;
					image_url?: string | null;
					vendor_id?: string | null;
					local_price?: number;
					foreign_price?: number;
					is_active?: boolean;
					display_order?: number;
					created_at?: string;
					updated_at?: string;
					deleted_at?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'activities_category_id_fkey';
						columns: ['category_id'];
						isOneToOne: false;
						referencedRelation: 'categories';
						referencedColumns: ['id'];
					},
				];
			};
			transaction_groups: {
				Row: {
					id: string;
					cashier_id: string;
					started_at: string;
					completed_at: string | null;
					notes: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					cashier_id: string;
					started_at?: string;
					completed_at?: string | null;
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					cashier_id?: string;
					started_at?: string;
					completed_at?: string | null;
					notes?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'transaction_groups_cashier_id_fkey';
						columns: ['cashier_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			transactions: {
				Row: {
					id: string;
					transaction_group_id: string;
					cashier_id: string;
					activity_id: string;
					price_type: 'local' | 'foreign';
					amount: number;
					token_index: number | null;
					token_total: number | null;
					txn_reference: string;
					print_status: 'pending' | 'printed' | 'failed';
					printed_at: string | null;
					cancelled_at: string | null;
					exchanged_to_transaction_id: string | null;
					exchanged_from_transaction_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					transaction_group_id: string;
					cashier_id: string;
					activity_id: string;
					price_type: 'local' | 'foreign';
					amount: number;
					token_index?: number | null;
					token_total?: number | null;
					txn_reference: string;
					print_status?: 'pending' | 'printed' | 'failed';
					printed_at?: string | null;
					cancelled_at?: string | null;
					exchanged_to_transaction_id?: string | null;
					exchanged_from_transaction_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					transaction_group_id?: string;
					cashier_id?: string;
					activity_id?: string;
					price_type?: 'local' | 'foreign';
					amount?: number;
					token_index?: number | null;
					token_total?: number | null;
					txn_reference?: string;
					print_status?: 'pending' | 'printed' | 'failed';
					printed_at?: string | null;
					cancelled_at?: string | null;
					exchanged_to_transaction_id?: string | null;
					exchanged_from_transaction_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'transactions_activity_id_fkey';
						columns: ['activity_id'];
						isOneToOne: false;
						referencedRelation: 'activities';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transactions_cashier_id_fkey';
						columns: ['cashier_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
					{
						foreignKeyName: 'transactions_transaction_group_id_fkey';
						columns: ['transaction_group_id'];
						isOneToOne: false;
						referencedRelation: 'transaction_groups';
						referencedColumns: ['id'];
					},
				];
			};
			tokens: {
				Row: {
					id: string;
					transaction_id: string;
					token_number: string;
					token_index: number;
					token_total: number;
					printed_at: string;
					reprint_count: number;
					first_reprinted_at: string | null;
					latest_reprinted_at: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					transaction_id: string;
					token_number: string;
					token_index?: number;
					token_total?: number;
					printed_at?: string;
					reprint_count?: number;
					first_reprinted_at?: string | null;
					latest_reprinted_at?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					transaction_id?: string;
					token_number?: string;
					token_index?: number;
					token_total?: number;
					printed_at?: string;
					reprint_count?: number;
					first_reprinted_at?: string | null;
					latest_reprinted_at?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'tokens_transaction_id_fkey';
						columns: ['transaction_id'];
						isOneToOne: false;
						referencedRelation: 'transactions';
						referencedColumns: ['id'];
					},
				];
			};
			audit_log: {
				Row: {
					id: string;
					user_id: string | null;
					action: string;
					entity_type: string | null;
					entity_id: string | null;
					metadata: Json | null;
					ip_address: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					action: string;
					entity_type?: string | null;
					entity_id?: string | null;
					metadata?: Json | null;
					ip_address?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string | null;
					action?: string;
					entity_type?: string | null;
					entity_id?: string | null;
					metadata?: Json | null;
					ip_address?: string | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'audit_log_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			error_logs: {
				Row: {
					id: string;
					user_id: string | null;
					message: string;
					stack: string | null;
					context: Json | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id?: string | null;
					message: string;
					stack?: string | null;
					context?: Json | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string | null;
					message?: string;
					stack?: string | null;
					context?: Json | null;
					created_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'error_logs_user_id_fkey';
						columns: ['user_id'];
						isOneToOne: false;
						referencedRelation: 'users';
						referencedColumns: ['id'];
					},
				];
			};
			printer_status_cache: {
				Row: {
					id: string;
					printer_ip: string;
					port: number;
					is_online: boolean;
					last_checked_at: string;
					error_message: string | null;
					updated_at: string;
				};
				Insert: {
					id?: string;
					printer_ip: string;
					port?: number;
					is_online?: boolean;
					last_checked_at?: string;
					error_message?: string | null;
					updated_at?: string;
				};
				Update: {
					id?: string;
					printer_ip?: string;
					port?: number;
					is_online?: boolean;
					last_checked_at?: string;
					error_message?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			daily_summary: {
				Row: {
					cashier_id: string | null;
					sale_date: string | null;
					activity_id: string | null;
					activity_name: string | null;
					price_type: 'local' | 'foreign' | null;
					count: number | null;
					total_amount: number | null;
				};
			};
		};
		Functions: {
			generate_token_number: {
				Args: Record<string, never>;
				Returns: string;
			};
			generate_txn_reference: {
				Args: {
					suffix?: string;
				};
				Returns: string;
			};
			reset_daily_token_sequence: {
				Args: Record<string, never>;
				Returns: undefined;
			};
		};
		Enums: {
			user_role: 'cashier' | 'admin' | 'vendor';
			price_type: 'local' | 'foreign';
			print_status: 'pending' | 'printed' | 'failed';
		};
		CompositeTypes: Record<string, never>;
	};
}
