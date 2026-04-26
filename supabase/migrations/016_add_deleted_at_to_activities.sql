-- Add deleted_at column to activities for soft deleting
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
