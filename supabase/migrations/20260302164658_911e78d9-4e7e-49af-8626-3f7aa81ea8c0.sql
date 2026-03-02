-- P1: Add restrictive base policies requiring authentication on sensitive tables
-- These are defense-in-depth: even if permissive policies have bugs, unauthenticated users are blocked

-- clients
CREATE POLICY "No public access to clients"
ON public.clients
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- operations
CREATE POLICY "No public access to operations"
ON public.operations
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- receivables
CREATE POLICY "No public access to receivables"
ON public.receivables
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- payments
CREATE POLICY "No public access to payments"
ON public.payments
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- user_roles
CREATE POLICY "No public access to user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);