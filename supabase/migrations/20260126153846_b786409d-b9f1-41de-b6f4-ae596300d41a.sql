-- Adicionar campos para correção/undo (soft-void e auditoria) na tabela payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_voided boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason text NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS voided_by uuid NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Criar índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_payments_receivable_id ON public.payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_is_voided ON public.payments(is_voided);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_payments_updated_at_trigger ON public.payments;
CREATE TRIGGER update_payments_updated_at_trigger
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payments_updated_at();