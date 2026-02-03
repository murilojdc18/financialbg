-- Add deny-all RLS policies to documents_duplicate table (consistent with documents table)
CREATE POLICY "No public access to documents_duplicate"
ON public.documents_duplicate
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Add deny-all RLS policies to produtos_tray_duplicate table (consistent with produtos_tray table)
CREATE POLICY "No public access to produtos_tray_duplicate"
ON public.produtos_tray_duplicate
FOR ALL
TO public
USING (false)
WITH CHECK (false);