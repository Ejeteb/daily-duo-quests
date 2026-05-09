
-- 1) Restrict submissions: prevent client UPDATE (verdict tampering).
DROP POLICY IF EXISTS "own submissions" ON public.submissions;

CREATE POLICY "select own submissions" ON public.submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert own submissions" ON public.submissions
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND verdict = 'pending'
    AND awarded_solo = false
    AND awarded_bonus = false
    AND rejection_reason IS NULL
  );

CREATE POLICY "delete own submissions" ON public.submissions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- No UPDATE policy for authenticated users. Service role (edge fn) bypasses RLS,
-- and the SECURITY DEFINER trigger handle_submission_xp can still write XP fields.

-- 2) Realtime.messages RLS: restrict subscriptions to topics that include the caller's uid.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duo own topic read" ON realtime.messages;
CREATE POLICY "duo own topic read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.topic() LIKE '%' || auth.uid()::text);

-- 3) Lock down SECURITY DEFINER functions that must not be callable by users.
REVOKE EXECUTE ON FUNCTION public.finalize_weeks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_submission_xp() FROM PUBLIC, anon, authenticated;
