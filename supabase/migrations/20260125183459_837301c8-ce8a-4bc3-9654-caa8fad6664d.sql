-- Drop the overly permissive policy that only checks authentication
-- The role-based policies (Admins can view/insert/update/delete, Client can view own) already properly restrict access
DROP POLICY IF EXISTS "No public access to clients" ON public.clients;