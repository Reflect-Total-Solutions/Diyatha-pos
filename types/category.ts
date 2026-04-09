/**
 * Category Type Definition
 * Represents an activity category (e.g., "Rides", "Games", "Food")
 */

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCategoryRequest = Pick<Category, 'name' | 'description'> & {
  is_active?: boolean;
};

export type UpdateCategoryRequest = Partial<
  Pick<Category, 'name' | 'description' | 'is_active'>
>;
