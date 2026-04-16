
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason text NULL;
