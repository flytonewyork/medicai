-- Slice M (continuation) — role-scoped write policies on cloud_rows
--
-- Slice B made cloud_rows readable / writable by any household member.
-- Slice M (the original migration) added the role enum + profile fields
-- but deliberately deferred role-scoped write policies. This migration
-- closes that gap.
--
-- Approach
--   1. Add a `can_write(user_id, household_id, action)` SQL function
--      mirroring the matrix in src/lib/auth/permissions.ts.
--   2. Map each cloud_rows.table_name to an action key.
--   3. Replace the household-scoped INSERT / UPDATE / DELETE policies
--      with role-aware ones that defer to (1) + (2).
--
-- Read policy is unchanged — every household member can still SELECT.
-- The matrix here is the authoritative server-side mirror of
-- PERMISSIONS in TypeScript; tests/unit/permissions.test.ts asserts
-- parity. When the TS matrix changes, this file changes.

-- ─── 1. helper functions ────────────────────────────────────────────

-- Returns the caller's role inside the given household, or NULL if
-- they aren't a member.
CREATE OR REPLACE FUNCTION public.role_in_household(
  user_uuid uuid,
  target_household uuid
)
  RETURNS public.household_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role
  FROM public.household_memberships
  WHERE user_id = user_uuid
    AND household_id = target_household
  LIMIT 1
$$;

-- Mirrors src/lib/auth/permissions.ts. When updating the TypeScript
-- matrix, update this case too. The parity test in
-- tests/unit/permissions.test.ts compares the two so drift surfaces
-- immediately.
CREATE OR REPLACE FUNCTION public.can_write(
  user_uuid uuid,
  target_household uuid,
  action text
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  caller_role public.household_role;
BEGIN
  caller_role := public.role_in_household(user_uuid, target_household);
  IF caller_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN CASE action
    WHEN 'invite_members' THEN caller_role IN ('primary_carer')
    WHEN 'remove_members' THEN caller_role IN ('primary_carer')
    WHEN 'edit_household_settings' THEN caller_role IN ('primary_carer')
    WHEN 'edit_treatment_plan' THEN caller_role IN ('primary_carer', 'clinician')
    WHEN 'edit_medications' THEN caller_role IN ('primary_carer', 'patient', 'clinician')
    WHEN 'edit_appointments' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'log_daily_checkin' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'log_clinical_note' THEN caller_role IN ('primary_carer', 'clinician')
    WHEN 'quick_note_family' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'confirm_self_attendance' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician')
    -- Read actions intentionally not enforced here — read RLS already
    -- gates SELECT on household membership. We list them so a parity
    -- test sees the full surface.
    WHEN 'see_clinical_data' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician', 'observer')
    WHEN 'see_family_notes' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'see_member_list' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician', 'observer')
    WHEN 'see_pending_invites' THEN caller_role IN ('primary_carer')
    ELSE false
  END;
END;
$$;

-- Maps a cloud_rows.table_name to the action key its writes require.
-- Tables not listed here fall into a catch-all that allows any
-- household member to write — preserves the prior behaviour for new
-- tables until they're explicitly classified.
CREATE OR REPLACE FUNCTION public.action_for_table(table_name text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS $$
  SELECT CASE table_name
    -- Clinical surface — viewers (observer, family) cannot write.
    WHEN 'labs' THEN 'log_clinical_note'
    WHEN 'imaging' THEN 'log_clinical_note'
    WHEN 'ctdna_results' THEN 'log_clinical_note'
    WHEN 'molecular_profile' THEN 'log_clinical_note'
    WHEN 'pending_results' THEN 'log_clinical_note'
    WHEN 'ingested_documents' THEN 'log_clinical_note'
    WHEN 'comprehensive_assessments' THEN 'log_clinical_note'
    WHEN 'fortnightly_assessments' THEN 'log_clinical_note'
    WHEN 'quarterly_reviews' THEN 'log_clinical_note'
    WHEN 'change_signals' THEN 'log_clinical_note'
    WHEN 'signal_events' THEN 'log_clinical_note'
    WHEN 'decisions' THEN 'log_clinical_note'
    -- Treatment plan — primary carer + clinician.
    WHEN 'treatments' THEN 'edit_treatment_plan'
    WHEN 'treatment_cycles' THEN 'edit_treatment_plan'
    WHEN 'trials' THEN 'edit_treatment_plan'
    -- Medication — primary carer, patient self-titration, clinician.
    WHEN 'medications' THEN 'edit_medications'
    WHEN 'medication_events' THEN 'edit_medications'
    WHEN 'medication_prompt_events' THEN 'edit_medications'
    -- Daily check-in family of tables.
    WHEN 'daily_entries' THEN 'log_daily_checkin'
    WHEN 'weekly_assessments' THEN 'log_daily_checkin'
    -- Family / patient narrative.
    WHEN 'family_notes' THEN 'quick_note_family'
    WHEN 'life_events' THEN 'quick_note_family'
    WHEN 'zone_alerts' THEN 'quick_note_family'
    WHEN 'patient_tasks' THEN 'quick_note_family'
    -- Household configuration — primary carer only.
    WHEN 'settings' THEN 'edit_household_settings'
    -- Catch-all: tables not yet classified fall back to membership-only
    -- write (the Slice B default).
    ELSE NULL
  END
$$;

-- Convenience predicate combining the table → action map and the role
-- check. NULL action_for_table → membership-only check.
CREATE OR REPLACE FUNCTION public.cloud_rows_can_write(
  user_uuid uuid,
  target_household uuid,
  target_table text
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  required_action text;
BEGIN
  IF public.role_in_household(user_uuid, target_household) IS NULL THEN
    RETURN false;
  END IF;

  required_action := public.action_for_table(target_table);
  IF required_action IS NULL THEN
    -- Unclassified table — fall back to the slice-B membership check.
    RETURN true;
  END IF;

  RETURN public.can_write(user_uuid, target_household, required_action);
END;
$$;

-- ─── 2. replace cloud_rows write policies ──────────────────────────

DROP POLICY IF EXISTS "cloud_rows insert (household member)"
  ON public.cloud_rows;
DROP POLICY IF EXISTS "cloud_rows update (household member)"
  ON public.cloud_rows;
DROP POLICY IF EXISTS "cloud_rows delete (household member)"
  ON public.cloud_rows;

DROP POLICY IF EXISTS "cloud_rows insert (role-scoped)"
  ON public.cloud_rows;
CREATE POLICY "cloud_rows insert (role-scoped)"
  ON public.cloud_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    public.cloud_rows_can_write(auth.uid(), household_id, table_name)
  );

DROP POLICY IF EXISTS "cloud_rows update (role-scoped)"
  ON public.cloud_rows;
CREATE POLICY "cloud_rows update (role-scoped)"
  ON public.cloud_rows FOR UPDATE
  TO authenticated
  USING (
    public.cloud_rows_can_write(auth.uid(), household_id, table_name)
  )
  WITH CHECK (
    public.cloud_rows_can_write(auth.uid(), household_id, table_name)
  );

DROP POLICY IF EXISTS "cloud_rows delete (role-scoped)"
  ON public.cloud_rows;
CREATE POLICY "cloud_rows delete (role-scoped)"
  ON public.cloud_rows FOR DELETE
  TO authenticated
  USING (
    public.cloud_rows_can_write(auth.uid(), household_id, table_name)
  );
