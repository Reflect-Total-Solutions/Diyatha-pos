-- Add linkage columns to support exchanges
ALTER TABLE public.transactions 
  ADD COLUMN exchanged_to_transaction_id uuid REFERENCES public.transactions(id),
  ADD COLUMN exchanged_from_transaction_id uuid REFERENCES public.transactions(id);

-- Add indexes for performance
CREATE INDEX idx_transactions_exchanged_to ON public.transactions(exchanged_to_transaction_id);
CREATE INDEX idx_transactions_exchanged_from ON public.transactions(exchanged_from_transaction_id);
