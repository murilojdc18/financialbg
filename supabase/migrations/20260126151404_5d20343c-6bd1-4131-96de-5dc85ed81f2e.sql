-- ============================================================
-- MIGRAÇÃO: Expandir tabela payments para pagamentos parciais
-- ============================================================

-- 1) Adicionar colunas faltantes
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS client_id uuid NULL,
  ADD COLUMN IF NOT EXISTS operation_id uuid NULL,
  ADD COLUMN IF NOT EXISTS note text NULL;

-- 2) Adicionar foreign keys
ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_client_id_fkey,
  ADD CONSTRAINT payments_client_id_fkey 
    FOREIGN KEY (client_id) REFERENCES public.clients(id);

ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_operation_id_fkey,
  ADD CONSTRAINT payments_operation_id_fkey 
    FOREIGN KEY (operation_id) REFERENCES public.operations(id);

-- 3) Atualizar receivable_id para ON DELETE CASCADE
ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_receivable_id_fkey,
  ADD CONSTRAINT payments_receivable_id_fkey 
    FOREIGN KEY (receivable_id) REFERENCES public.receivables(id) ON DELETE CASCADE;

-- 4) Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_payments_receivable_id ON public.payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_operation_id ON public.payments(operation_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);

-- 5) Comentários explicativos
COMMENT ON TABLE public.payments IS 'Registros de pagamentos (permite múltiplos por parcela para pagamento parcial)';
COMMENT ON COLUMN public.payments.client_id IS 'Cliente que realizou o pagamento';
COMMENT ON COLUMN public.payments.operation_id IS 'Operação relacionada ao pagamento';
COMMENT ON COLUMN public.payments.note IS 'Observações sobre o pagamento';