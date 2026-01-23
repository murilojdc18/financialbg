-- =====================================================
-- AUDITORIA DE SEGURANÇA - CORREÇÕES DE RLS
-- =====================================================

-- 1. HABILITAR RLS EM TABELAS NÃO PROTEGIDAS
-- (Estas tabelas parecem ser de uso interno/n8n, não do app principal)
-- Se não forem usadas, considere excluí-las

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos_tray ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES PARA user_roles (tabela crítica sem policies!)
-- Usuários podem ver suas próprias roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Apenas sistema pode gerenciar roles (via service_role)
CREATE POLICY "System manages roles"
ON public.user_roles
FOR ALL
USING (false)
WITH CHECK (false);

-- 3. POLICY PARA CLIENT VER SEU PRÓPRIO REGISTRO EM clients
-- (para exibir nome/dados no portal)
CREATE POLICY "Client can view own client record"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND id = get_my_client_id()
);

-- 4. POLICY PARA CLIENT VER PAGAMENTOS DE SUAS PARCELAS
CREATE POLICY "Client can view own payments"
ON public.payments
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.receivables r 
    WHERE r.id = payments.receivable_id 
    AND r.client_id = get_my_client_id()
  )
);

-- 5. REMOVER POLICIES REDUNDANTES DE operations
-- (mantendo apenas as mais específicas)
DROP POLICY IF EXISTS "Admin full access" ON public.operations;
DROP POLICY IF EXISTS "Users can delete own operations" ON public.operations;
DROP POLICY IF EXISTS "Users can insert own operations" ON public.operations;
DROP POLICY IF EXISTS "Users can update own operations" ON public.operations;

-- 6. REMOVER POLICIES REDUNDANTES DE receivables
DROP POLICY IF EXISTS "Users can delete own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can insert own receivables" ON public.receivables;
DROP POLICY IF EXISTS "Users can update own receivables" ON public.receivables;

-- 7. REMOVER POLICIES REDUNDANTES DE payments
DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;

-- 8. CORRIGIR search_path DAS FUNÇÕES
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector, 
  match_count integer DEFAULT NULL::integer, 
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;