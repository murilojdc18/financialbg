ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS manual_adjustment_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_adjustment_reason text NULL,
  ADD COLUMN IF NOT EXISTS is_manual_amount boolean NOT NULL DEFAULT false;