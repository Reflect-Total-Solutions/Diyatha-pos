/**
 * Activity Type Definition
 * Represents a purchasable activity/ticket at the carnival
 */

export interface Activity {
  id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  vendor_id?: string | null;
  image_url?: string | null;
  local_price: number;
  foreign_price: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type CreateActivityRequest = Pick<
  Activity,
  'name' | 'category_id' | 'vendor_id' | 'image_url' | 'local_price' | 'foreign_price' | 'description'
> & {
  is_active?: boolean;
  display_order?: number;
};

export type UpdateActivityRequest = Partial<
  Pick<Activity, 'name' | 'description' | 'category_id' | 'vendor_id' | 'image_url' | 'local_price' | 'foreign_price' | 'is_active' | 'display_order'>
>;
