-- =====================================================
-- POLICIES PARA TABELAS n8n/produtos (uso interno)
-- Essas tabelas NÃO devem ser acessíveis via API pública
-- =====================================================

-- DOCUMENTS - apenas para uso interno (embeddings de IA)
CREATE POLICY "No public access to documents"
ON public.documents
FOR ALL
USING (false)
WITH CHECK (false);

-- DOCUMENTS_TESTE - apenas para uso interno
CREATE POLICY "No public access to documents_teste"
ON public.documents_teste
FOR ALL
USING (false)
WITH CHECK (false);

-- N8N_CHAT_HISTORIES - apenas para uso interno
CREATE POLICY "No public access to n8n_chat_histories"
ON public.n8n_chat_histories
FOR ALL
USING (false)
WITH CHECK (false);

-- PRODUTOS_TRAY - apenas para uso interno
CREATE POLICY "No public access to produtos_tray"
ON public.produtos_tray
FOR ALL
USING (false)
WITH CHECK (false);