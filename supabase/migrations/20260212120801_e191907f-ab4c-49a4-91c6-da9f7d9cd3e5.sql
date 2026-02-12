
-- Add columns to discriminate contract interest from late interest in payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS alloc_contract_interest numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alloc_late_interest numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_contract_interest numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_late_interest numeric DEFAULT 0;

-- Backfill: existing alloc_interest goes to alloc_late_interest (legacy data was only late interest)
UPDATE public.payments 
SET alloc_late_interest = COALESCE(alloc_interest, 0),
    alloc_contract_interest = 0
WHERE alloc_late_interest = 0 AND COALESCE(alloc_interest, 0) > 0;
