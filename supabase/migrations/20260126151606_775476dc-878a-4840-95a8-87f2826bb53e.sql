-- Adicionar campo para rastrear renegociações
ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS renegotiated_to_receivable_id uuid NULL;

ALTER TABLE public.receivables 
  DROP CONSTRAINT IF EXISTS receivables_renegotiated_to_fkey,
  ADD CONSTRAINT receivables_renegotiated_to_fkey 
    FOREIGN KEY (renegotiated_to_receivable_id) REFERENCES public.receivables(id);

COMMENT ON COLUMN public.receivables.renegotiated_to_receivable_id IS 'ID da nova parcela criada ao postergar saldo';