-- Fix infinite recursion in household_memberships RLS policy.
--
-- The Slice A SELECT policy on household_memberships used a subquery
-- against household_memberships in its USING clause:
--
--   USING (
--     household_id IN (
--       SELECT household_id FROM public.household_memberships
--       WHERE user_id = auth.uid()
--     )
--   )
--
-- PostgreSQL re-invokes the policy on that inner SELECT, which fires
-- the same policy again, which fires the same subquery again — an
-- infinite recursion that surfaces as `42P17 infinite recursion
-- detected in policy for relation "household_memberships"`. The
-- error is fatal: any read of household_memberships fails, and the
-- failure cascades to every other table whose policies reference
-- memberships (households, profiles, household_invites,
-- cloud_rows). Symptom in the app: createHousehold's
-- getCurrentMembership() call throws on what should be a no-op
-- "do I already belong to a household?" lookup.
--
-- Fix: route the membership check through a SECURITY DEFINER
-- function. SECURITY DEFINER bypasses RLS for the function body, so
-- the inner query no longer re-invokes the policy. The outer
-- policy's USING clause becomes a simple boolean call.
--
-- We add a fast-path `user_id = auth.uid()` first so reading your
-- own row never has to enter the helper.
--
-- Idempotent — safe to re-run.

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.is_household_member(target_household uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_memberships
    WHERE household_id = target_household
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;

-- Replace the recursive SELECT policy. The new USING clause:
--   - Always lets a user see their own row (user_id = auth.uid()).
--   - Lets them see other rows in households they belong to, via
--     the SECURITY DEFINER membership helper (no recursion).
DROP POLICY IF EXISTS "memberships read (same household)"
  ON public.household_memberships;
CREATE POLICY "memberships read (same household)"
  ON public.household_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_household_member(household_id)
  );

-- Force PostgREST to refresh its schema cache so the new function
-- + policy are visible without a server restart.
NOTIFY pgrst, 'reload schema';
