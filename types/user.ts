/**
 * User Type Definition
 * Represents a system user (cashier or admin)
 */

export type UserRole = 'cashier' | 'admin' | 'vendor';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
  phone?: string | null;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until?: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateUserRequest = Pick<User, 'email' | 'display_name' | 'role'> & {
  password: string;
  phone?: string;
  is_active?: boolean;
};

export type UpdateUserRequest = Partial<
  Pick<User, 'display_name' | 'email' | 'phone' | 'role' | 'is_active'>
>;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface CurrentUserResponse {
  user: User;
  session: {
    access_token: string;
    expires_at: number;
  };
}
