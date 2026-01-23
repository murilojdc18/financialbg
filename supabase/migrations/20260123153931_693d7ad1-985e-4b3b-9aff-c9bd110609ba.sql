-- Add SELECT policy for clients to view their own receivables
CREATE POLICY "Client can view own receivables"
ON public.receivables
FOR SELECT
USING (
  has_role(auth.uid(), 'client'::app_role) 
  AND client_id = get_my_client_id()
);