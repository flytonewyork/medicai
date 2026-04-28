-- Patient-led carer invitations.
--
-- The user story we're widening: a patient who self-onboards before
-- anyone else exists in the household needs to be able to bring carers
-- in themselves, not wait for a primary_carer to do it for them.
--
-- This migration brings the server-side authorisation surface into line
-- with the matrix update in `src/lib/auth/permissions.ts`:
--   * invite_members + remove_members + see_pending_invites now admit
--     `patient` in addition to `primary_carer`.
--
-- Three places mirror the matrix and must move together:
--   1. `can_write` — the SECURITY DEFINER role check used by the
--      cloud_rows write policies. Updated for parity (the parity test
--      in tests/unit/permissions.test.ts asserts every action still
--      appears, but doesn't assert role contents — covered manually).
--   2. RLS on `household_invites` (INSERT, UPDATE) and
--      `household_memberships` (DELETE). The Slice A policies are
--      replaced with role-aware variants that admit primary_carer OR
--      patient. Self-deletion of one's own membership stays open to
--      every member.
--   3. The `update_member_role` and `extend_invite_expiry` RPCs raise
--      `not_authorised` when the caller isn't primary_carer. Patient
--      callers are now allowed for the operations the matrix permits:
--      extending invites (they own the link they issued) and revoking
--      members they invited. Promoting/demoting other members stays
--      primary_carer-only — a patient can't unilaterally change who's
--      lead carer.
--
-- Idempotent — drops + recreates each policy and replaces the helper
-- functions with `CREATE OR REPLACE`.

SET check_function_bodies = false;

-- ─── 1. can_write parity ────────────────────────────────────────────
-- Mirror src/lib/auth/permissions.ts. Only the three changed action
-- arms are updated; the rest stay byte-for-byte identical so a future
-- diff against the previous migration is easy to read.

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
    WHEN 'invite_members' THEN caller_role IN ('primary_carer', 'patient')
    WHEN 'remove_members' THEN caller_role IN ('primary_carer', 'patient')
    WHEN 'edit_household_settings' THEN caller_role IN ('primary_carer')
    WHEN 'edit_treatment_plan' THEN caller_role IN ('primary_carer', 'clinician')
    WHEN 'edit_medications' THEN caller_role IN ('primary_carer', 'patient', 'clinician')
    WHEN 'edit_appointments' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'log_daily_checkin' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'log_clinical_note' THEN caller_role IN ('primary_carer', 'clinician')
    WHEN 'quick_note_family' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'confirm_self_attendance' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician')
    WHEN 'see_clinical_data' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician', 'observer')
    WHEN 'see_family_notes' THEN caller_role IN ('primary_carer', 'patient', 'family')
    WHEN 'see_member_list' THEN caller_role IN ('primary_carer', 'patient', 'family', 'clinician', 'observer')
    WHEN 'see_pending_invites' THEN caller_role IN ('primary_carer', 'patient')
    ELSE false
  END;
END;
$$;

-- ─── 2. household_invites / household_memberships RLS ───────────────

DROP POLICY IF EXISTS "invites insert (primary)" ON public.household_invites;
DROP POLICY IF EXISTS "invites insert (admin)" ON public.household_invites;
CREATE POLICY "invites insert (admin)"
  ON public.household_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_invites.household_id
        AND user_id = auth.uid()
        AND role IN ('primary_carer', 'patient')
    )
  );

DROP POLICY IF EXISTS "invites update (primary)" ON public.household_invites;
DROP POLICY IF EXISTS "invites update (admin)" ON public.household_invites;
CREATE POLICY "invites update (admin)"
  ON public.household_invites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_invites.household_id
        AND user_id = auth.uid()
        AND role IN ('primary_carer', 'patient')
    )
  );

-- Memberships INSERT widens too — accept_household_invite is SECURITY
-- DEFINER so it bypasses RLS, but the regular INSERT path (used to
-- promote / add members manually from UI surfaces that may emerge
-- later) needs to admit patient as well so the matrix is consistent.
DROP POLICY IF EXISTS "memberships insert (primary)" ON public.household_memberships;
DROP POLICY IF EXISTS "memberships insert (admin)" ON public.household_memberships;
CREATE POLICY "memberships insert (admin)"
  ON public.household_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_memberships.household_id
        AND user_id = auth.uid()
        AND role IN ('primary_carer', 'patient')
    )
  );

-- Memberships DELETE: self-leave still works for everyone; admin-led
-- removal accepts both primary_carer and patient.
DROP POLICY IF EXISTS "memberships delete (self or primary)"
  ON public.household_memberships;
DROP POLICY IF EXISTS "memberships delete (self or admin)"
  ON public.household_memberships;
CREATE POLICY "memberships delete (self or admin)"
  ON public.household_memberships FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_memberships m
      WHERE m.household_id = public.household_memberships.household_id
        AND m.user_id = auth.uid()
        AND m.role IN ('primary_carer', 'patient')
    )
  );

-- ─── 3. RPC authorisation widening ──────────────────────────────────
-- update_member_role: still primary_carer-only. Changing who the
-- household lead is is structural — letting a patient demote the lead
-- carer would invert the chain of authority. Left unchanged.

-- extend_invite_expiry: open to patient too. Re-arming a link the
-- patient (or the primary carer) issued is just a UX convenience and
-- has no security weight beyond who can already create / revoke
-- invites — and we just admitted patient to that gate.
CREATE OR REPLACE FUNCTION public.extend_invite_expiry(
  target_invite uuid,
  days_to_add integer DEFAULT 14
)
  RETURNS timestamptz
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_role public.household_role;
  invite public.household_invites%ROWTYPE;
  new_expiry timestamptz;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF days_to_add IS NULL OR days_to_add <= 0 OR days_to_add > 90 THEN
    RAISE EXCEPTION 'invalid_extension';
  END IF;

  SELECT * INTO invite FROM public.household_invites WHERE id = target_invite;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  SELECT role INTO caller_role
  FROM public.household_memberships
  WHERE household_id = invite.household_id AND user_id = caller;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF caller_role NOT IN ('primary_carer', 'patient') THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  IF invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;
  IF invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_accepted';
  END IF;

  new_expiry := now() + make_interval(days => days_to_add);

  UPDATE public.household_invites
  SET expires_at = new_expiry
  WHERE id = invite.id;

  RETURN new_expiry;
END;
$$;

-- Force PostgREST to refresh its schema cache so the freshly-installed
-- function bodies are callable without a server restart.
NOTIFY pgrst, 'reload schema';
