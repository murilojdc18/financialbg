-- Create table to track claim attempts for rate limiting
CREATE TABLE public.claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can insert/query
CREATE POLICY "No public access to claim_attempts"
ON public.claim_attempts
FOR ALL
USING (false)
WITH CHECK (false);

-- Index for efficient querying by user_id and time
CREATE INDEX idx_claim_attempts_user_time ON public.claim_attempts (user_id, attempted_at DESC);

-- Cleanup function to remove old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_claim_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.claim_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';
$$;