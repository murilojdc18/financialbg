-- =====================================================
-- MIGRATION: Pagamentos flexíveis com alocação detalhada
-- =====================================================

-- 1) PAYMENTS: Adicionar campos de alocação (se não existirem)
-- amount_total para o valor total do pagamento
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS amount_total numeric(14,2);

-- Campos de alocação (quanto foi para cada componente)
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS alloc_penalty numeric(14,2) DEFAULT 0;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS alloc_interest numeric(14,2) DEFAULT 0;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS alloc_principal numeric(14,2) DEFAULT 0;

-- Campos de desconto/isenção negociada
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS discount_penalty numeric(14,2) DEFAULT 0;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS discount_interest numeric(14,2) DEFAULT 0;

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS discount_principal numeric(14,2) DEFAULT 0;

-- Preencher amount_total com o valor de amount para registros existentes
UPDATE public.payments 
SET amount_total = amount 
WHERE amount_total IS NULL;

-- Agora tornar amount_total NOT NULL
ALTER TABLE public.payments 
  ALTER COLUMN amount_total SET NOT NULL;

-- 2) RECEIVABLES: Garantir campos de renegociação (já existem no schema, mas vamos garantir)
-- Os campos carried_penalty_amount, carried_interest_amount, renegotiated_from_receivable_id, accrual_frozen_at
-- já existem conforme o schema atual

-- 3) Adicionar 'RENEGOCIADA' ao enum receivable_status (se não existir)
DO $$ 
BEGIN
  -- Verificar se o valor já existe no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'RENEGOCIADA' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'receivable_status')
  ) THEN
    ALTER TYPE receivable_status ADD VALUE 'RENEGOCIADA';
  END IF;
END $$;

-- 4) ÍNDICES para payments (se não existirem)
CREATE INDEX IF NOT EXISTS idx_payments_receivable_id ON public.payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_operation_id ON public.payments(operation_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_is_voided ON public.payments(is_voided);

-- 5) ÍNDICES para receivables (se não existirem)
CREATE INDEX IF NOT EXISTS idx_receivables_operation_id ON public.receivables(operation_id);
CREATE INDEX IF NOT EXISTS idx_receivables_client_id ON public.receivables(client_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);

-- 6) Índice composto útil para relatórios
CREATE INDEX IF NOT EXISTS idx_payments_allocation_report 
  ON public.payments(paid_at, is_voided) 
  WHERE is_voided = false;