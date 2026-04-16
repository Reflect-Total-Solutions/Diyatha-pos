/**
 * Validation Schemas
 * Zod schemas for API request validation
 */

import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================================================
// Activity Schemas
// ============================================================================

export const ActivitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  category_id: z.string().uuid('Invalid category ID').optional(),
  local_price: z.number().min(0, 'Price must be non-negative').max(99999, 'Price is too high'),
  foreign_price: z.number().min(0, 'Price must be non-negative').max(99999, 'Price is too high'),
  image_url: z.string().url('Invalid image URL').optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().optional(),
});

export type ActivityInput = z.infer<typeof ActivitySchema>;

export const UpdateActivitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  description: z.string().optional(),
  category_id: z.string().uuid('Invalid category ID').nullable().optional(),
  local_price: z.number().min(0, 'Price must be non-negative').max(99999, 'Price is too high').optional(),
  foreign_price: z.number().min(0, 'Price must be non-negative').max(99999, 'Price is too high').optional(),
  image_url: z.string().url('Invalid image URL').nullable().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0, 'Display order must be 0 or greater').optional(),
});

export type UpdateActivityInput = z.infer<typeof UpdateActivitySchema>;

// ============================================================================
// Category Schemas
// ============================================================================

export const CategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type CategoryInput = z.infer<typeof CategorySchema>;

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

// ============================================================================
// Transaction Schemas
// ============================================================================

export const TransactionSchema = z.object({
  transaction_group_id: z.string().uuid('Invalid group ID'),
  activity_id: z.string().uuid('Invalid activity ID'),
  price_type: z.enum(['local', 'foreign']).describe('Price type must be "local" or "foreign"'),
  amount: z.number().min(0, 'Amount must be non-negative'),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

export const BulkTransactionSchema = z.object({
  transaction_group_id: z.string().uuid('Invalid group ID').optional(),
  payment_method: z.enum(['cash', 'card']).optional().default('cash'),
  items: z
    .array(
      z.object({
        activity_id: z.string().uuid('Invalid activity ID'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Maximum 50 tickets per activity'),
        price_type: z.enum(['local', 'foreign']).describe('Price type must be "local" or "foreign"'),
      })
    )
    .min(1, 'At least one item is required')
    .max(20, 'Maximum 20 different activities per bulk transaction'),
});

export type BulkTransactionInput = z.infer<typeof BulkTransactionSchema>;

// ============================================================================
// Print Schemas
// ============================================================================

export const PrintRequestSchema = z.object({
  transaction_id: z.string().uuid('Invalid transaction ID'),
  targetIp: z.string().optional(),
  targetInterface: z.string().optional(),
});

export type PrintRequestInput = z.infer<typeof PrintRequestSchema>;

// ============================================================================
// User Schemas
// ============================================================================

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  display_name: z.string().min(1, 'Display name is required').max(100, 'Name must be 100 characters or less'),
  role: z.enum(['cashier', 'admin']).describe('Role must be "cashier" or "admin"'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  display_name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().optional(),
  role: z.enum(['cashier', 'admin']).describe('Role must be "cashier" or "admin"').optional(),
  is_active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================================================
// Transaction Group Schemas
// ============================================================================

export const CreateTransactionGroupSchema = z.object({
  notes: z.string().optional(),
});

export type CreateTransactionGroupInput = z.infer<typeof CreateTransactionGroupSchema>;

// ============================================================================
// Search & Filter Schemas
// ============================================================================

export const TransactionSearchSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  token: z.string().optional(),
  activityId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  limit: z.number().min(1).max(500).optional(),
  offset: z.number().min(0).optional(),
});

export type TransactionSearchInput = z.infer<typeof TransactionSearchSchema>;

// ============================================================================
// Pagination Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().min(1).optional(),
  per_page: z.number().min(1).max(500).optional(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate and parse input against a schema
 * Returns { valid: true, data } or { valid: false, errors }
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { valid: true; data: T } | { valid: false; errors: string[] } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return { valid: false, errors };
}
