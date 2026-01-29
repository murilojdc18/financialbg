-- Adicionar campos para suportar renegociação com encargos carregados
-- e congelamento de accrual

-- Campos para encargos trazidos de renegociação anterior
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS carried_penalty_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carried_interest_amount numeric(14,2) DEFAULT 0;

-- Campo para rastrear origem da renegociação (de qual parcela veio)
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS renegotiated_from_receivable_id uuid NULL REFERENCES public.receivables(id);

-- Campo para congelar acumulação de encargos após renegociação
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS accrual_frozen_at date NULL;

-- Índice para consultas de renegociação
CREATE INDEX IF NOT EXISTS idx_receivables_renegotiated_from 
  ON public.receivables(renegotiated_from_receivable_id);

-- Comentários para documentação
COMMENT ON COLUMN public.receivables.carried_penalty_amount IS 'Multa trazida de renegociação anterior';
COMMENT ON COLUMN public.receivables.carried_interest_amount IS 'Juros/mora trazidos de renegociação anterior';
COMMENT ON COLUMN public.receivables.renegotiated_from_receivable_id IS 'ID da parcela original de onde esta foi renegociada';
COMMENT ON COLUMN public.receivables.accrual_frozen_at IS 'Data em que encargos param de acumular (após renegociação)';