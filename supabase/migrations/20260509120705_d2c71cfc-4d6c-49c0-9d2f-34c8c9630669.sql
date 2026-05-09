
ALTER TABLE public.submissions ALTER COLUMN verdict SET DEFAULT 'approved';

DROP POLICY IF EXISTS "insert own submissions" ON public.submissions;

CREATE POLICY "insert own submissions"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND verdict = 'approved'
  AND awarded_solo = false
  AND awarded_bonus = false
  AND rejection_reason IS NULL
);
