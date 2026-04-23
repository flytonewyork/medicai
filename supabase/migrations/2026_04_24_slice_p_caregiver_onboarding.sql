-- Slice P: caregiver onboarding path. Two RPCs that let a new family
-- member pick an existing patient's household from a list and join it
-- directly, without needing the primary_carer to generate an invite
-- token. Installed as SECURITY DEFINER because the existing RLS
-- policies scope household SELECTs to existing members and restrict
-- membership INSERTs to primary_carers.
--
-- The design choice is deliberate: per the product owner, "this app is
-- for our family only" — every patient in the database is discoverable
-- to every authenticated user. If that assumption changes later, add a
-- `discoverable boolean` on households and filter here; the signatures
-- below don't need to change.

SET check_function_bodies = false;

-- ---------------------------------------------------------------------
-- list_all_households — returns a lightweight summary of every household
-- (patient display name + member count) for picker UIs.
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- join_household_as_family — inserts a `family` membership for the
-- calling user against `target_id`. Idempotent: re-calls with an
-- existing membership are a no-op and return the original row's
-- household id.
-- ---------------------------------------------------------------------

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
