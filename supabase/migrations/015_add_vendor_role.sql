-- Add 'vendor' to user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'vendor';

-- Add vendor_id to activities
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Update the materialized view (daily_summary)
DROP VIEW IF EXISTS public.daily_summary;

CREATE VIEW public.daily_summary AS
  SELECT
    t.cashier_id,
    a.vendor_id,
    date(t.created_at AT TIME ZONE 'Asia/Colombo') AS sale_date,
    a.id AS activity_id,
    a.name AS activity_name,
    t.price_type,
    count(*) FILTER (WHERE t.cancelled_at IS NULL) AS count,
    sum(t.amount) FILTER (WHERE t.cancelled_at IS NULL) AS total_amount,    
    t.payment_method
  FROM public.transactions t
  JOIN public.activities a ON a.id = t.activity_id
  WHERE t.created_at >= now() - interval '2 years'
  GROUP BY
    t.cashier_id,
    a.vendor_id,
    date(t.created_at AT TIME ZONE 'Asia/Colombo'),
    a.id,
    a.name,
    t.price_type,
    t.payment_method;

-- Add RLS policies for the vendor role

-- Activities: Vendor can read their assigned activities
CREATE POLICY "vendor_read_own_activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'vendor' 
    AND vendor_id = auth.uid()
  );

-- Transactions: Vendor can read transactions for their activities
CREATE POLICY "vendor_read_own_transactions"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'vendor' 
    AND activity_id IN (
      SELECT id FROM public.activities 
      WHERE vendor_id = auth.uid()
    )
  );

-- Tokens: Vendor can read tokens associated with transactions for their activities
CREATE POLICY "vendor_read_own_tokens"
  ON public.tokens
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'vendor' 
    AND transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.activities a ON a.id = t.activity_id
      WHERE a.vendor_id = auth.uid()
    )
  );
