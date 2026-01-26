-- Adicionar policy de UPDATE para admins na tabela payments
CREATE POLICY "Admins can update payments"
ON public.payments
FOR UPDATE
USING (
  (owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)
);