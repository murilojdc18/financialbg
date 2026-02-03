-- Add DELETE policy for operations (admin only, owns the record)
CREATE POLICY "Admins can delete own operations"
ON public.operations
FOR DELETE
USING ((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for receivables (admin only, owns the record)
CREATE POLICY "Admins can delete own receivables"
ON public.receivables
FOR DELETE
USING ((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Add archived_at column for soft delete tracking
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;