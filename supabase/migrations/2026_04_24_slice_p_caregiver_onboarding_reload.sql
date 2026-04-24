-- Slice P follow-up: re-create the caregiver-onboarding RPCs idempotently
-- and force PostgREST to reload its schema cache.
--
-- The original `2026_04_24_slice_p_caregiver_onboarding.sql` ships the
-- two functions (`list_all_households`, `join_household_as_family`), but
-- on instances where the migration was applied without the schema-cache
-- being refreshed PostgREST keeps returning
--   "Could not find the function public.list_all_households without
--    parameters in the schema cache"
-- (PostgREST PGRST202). This file is safe to apply on any instance:
-- - if the functions don't exist yet it creates them
-- - if they already exist `CREATE OR REPLACE` re-installs them
-- - the trailing `NOTIFY pgrst, 'reload schema'` flushes the cache so
--   the new definitions are picked up immediately.

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.list_all_households()
  RETURNS TABLE (
    id uuid,
    name text,
    patient_display_name text,
    created_at timestamptz,
    member_count integer
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT
    h.id,
    h.name,
    h.patient_display_name,
    h.created_at,
    (
      SELECT count(*)::integer
      FROM public.household_memberships hm
      WHERE hm.household_id = h.id
    ) AS member_count
  FROM public.households h
  ORDER BY h.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.list_all_households() FROM public;
GRANT EXECUTE ON FUNCTION public.list_all_households() TO authenticated;

CREATE OR REPLACE FUNCTION public.join_household_as_family(target_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  existing_household uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = target_id) THEN
    RAISE EXCEPTION 'household_not_found';
  END IF;

  SELECT household_id
    INTO existing_household
  FROM public.household_memberships
  WHERE household_id = target_id AND user_id = caller;

  IF existing_household IS NOT NULL THEN
    RETURN existing_household;
  END IF;

  INSERT INTO public.household_memberships (
    household_id,
    user_id,
    role,
    invited_by,
    joined_at
  )
  VALUES (target_id, caller, 'family', NULL, now());

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household_as_family(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_household_as_family(uuid) TO authenticated;

-- Force PostgREST to refresh its schema cache so the freshly-installed
-- functions become callable immediately. Without this the API keeps
-- returning PGRST202 until something else triggers a reload (e.g. a DDL
-- in the same transaction or a manual restart in the dashboard).
NOTIFY pgrst, 'reload schema';
