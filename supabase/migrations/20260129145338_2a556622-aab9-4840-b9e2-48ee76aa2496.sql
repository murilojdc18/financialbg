-- Adicionar coluna cash_source na tabela operations
ALTER TABLE public.operations 
  ADD COLUMN IF NOT EXISTS cash_source text NOT NULL DEFAULT 'B&G';

-- Adicionar constraint para validar valores permitidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'operations_cash_source_check'
  ) THEN
    ALTER TABLE public.operations 
      ADD CONSTRAINT operations_cash_source_check 
      CHECK (cash_source IN ('B&G', 'PESSOAL'));
  END IF;
END $$;

-- Criar índice para performance de filtros
CREATE INDEX IF NOT EXISTS idx_operations_cash_source ON public.operations(cash_source);