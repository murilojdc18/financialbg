-- Add RESTRICTIVE policy to explicitly block public/anonymous access to clients table
CREATE POLICY "No public access to clients"
ON public.clients
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Add RESTRICTIVE policy to explicitly block public/anonymous access to profiles table
CREATE POLICY "No public access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
USING (auth.uid() IS NOT NULL);