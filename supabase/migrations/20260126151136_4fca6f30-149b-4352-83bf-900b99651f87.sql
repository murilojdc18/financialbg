-- ============================================================
-- MIGRAÇÃO: Suporte a Multa 10% + Mora 0,5% ao dia
-- ============================================================

-- 1) OPERATIONS: Adicionar campo de juros diário (mantendo mensal para compatibilidade)
ALTER TABLE public.operations 
  ADD COLUMN IF NOT EXISTS late_interest_daily_percent numeric(9,4) DEFAULT 0.5000;

-- Atualizar defaults existentes para os novos valores padrão
ALTER TABLE public.operations 
  ALTER COLUMN late_grace_days SET DEFAULT 0,
  ALTER COLUMN late_penalty_percent SET DEFAULT 10.0000;

-- Comentário explicativo
COMMENT ON COLUMN public.operations.late_interest_monthly_percent IS 'DEPRECATED: Use late_interest_daily_percent. Mantido para compatibilidade.';
COMMENT ON COLUMN public.operations.late_interest_daily_percent IS 'Juros de mora diário simples (ex: 0.5 = 0,5% ao dia)';
COMMENT ON COLUMN public.operations.late_penalty_percent IS 'Multa única ao entrar em atraso (ex: 10 = 10%)';
COMMENT ON COLUMN public.operations.late_grace_days IS 'Dias de carência antes de aplicar multa/mora';

-- 2) RECEIVABLES: Adicionar valor 'PARCIAL' ao enum de status
ALTER TYPE public.receivable_status ADD VALUE IF NOT EXISTS 'PARCIAL';

-- 3) RECEIVABLES: Adicionar campos para controle de multa/mora e pagamento parcial
ALTER TABLE public.receivables 
  ADD COLUMN IF NOT EXISTS penalty_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS penalty_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_accrued numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interest_calc_at date NULL;

-- Garantir que amount_paid tenha default 0 (já existe, mas ajustar default)
ALTER TABLE public.receivables 
  ALTER COLUMN amount_paid SET DEFAULT 0;

-- Comentários explicativos
COMMENT ON COLUMN public.receivables.penalty_applied IS 'Se a multa única já foi aplicada';
COMMENT ON COLUMN public.receivables.penalty_amount IS 'Valor da multa aplicada em R$';
COMMENT ON COLUMN public.receivables.interest_accrued IS 'Total de juros de mora acumulados em R$';
COMMENT ON COLUMN public.receivables.last_interest_calc_at IS 'Data do último cálculo de juros de mora';
COMMENT ON COLUMN public.receivables.amount_paid IS 'Valor total já pago (para pagamentos parciais)';

-- 4) ÍNDICES: Criar índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_receivables_operation_id ON public.receivables(operation_id);
CREATE INDEX IF NOT EXISTS idx_receivables_client_id ON public.receivables(client_id);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);

-- Índice composto útil para queries de parcelas em aberto/atrasadas por cliente
CREATE INDEX IF NOT EXISTS idx_receivables_client_status_due ON public.receivables(client_id, status, due_date);