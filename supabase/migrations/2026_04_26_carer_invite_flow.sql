-- Carer invite flow — preview, role updates, and expiry extension.
--
-- Slice A laid down the household_invites table, an `accept_household_invite`
-- RPC, and RLS policies that scope SELECT/INSERT/UPDATE to existing members.
-- This migration fills three gaps that the polished invite UX needs:
--
--  (1) `get_invite_preview(token)` — lets an unauthenticated invitee see
--      WHO invited them, to WHICH household, and AS WHAT role, BEFORE
--      they're asked to sign in. Without this the /invite/<token> page
--      bounces straight to /login with no reassurance the link is real
--      or pointed at the right family. Returns just the fields needed
--      to render trust copy; no clinical data.
--
--  (2) `update_member_role(target_household, target_user, new_role)` —
--      lets the primary_carer change a member's role after the fact
--      (e.g. a relative joined as `family` and later took on more of a
--      clinical-coordination role). The RLS policies on
--      household_memberships allow primary_carer UPDATEs in spirit, but
--      to keep call-sites simple we wrap it in a SECURITY DEFINER RPC
--      with explicit error codes. Prevents removing the last
--      primary_carer (so a household can't be orphaned).
--
--  (3) `extend_invite_expiry(invite_id, days)` — re-arms an unaccepted
--      invite for another N days (default 14). Saves the carer from
--      having to revoke + re-create + re-share a fresh URL when a
--      relative drags their feet.
--
-- All three functions are SECURITY DEFINER with `search_path = public`
-- per Supabase guidance, REVOKEd from public, and GRANTed to either
-- `anon, authenticated` (preview) or `authenticated` (mutations).
-- Idempotent — safe to re-run.

SET check_function_bodies = false;

-- ─── invite preview (PUBLIC — no auth required) ─────────────────────
-- Returns the minimal trust info an invitee needs before deciding
-- whether to sign in / sign up. Status is one of:
--   'active' | 'expired' | 'revoked' | 'accepted' | 'not_found'
-- The function never raises — it surfaces the status field instead so
-- the client can render a useful error UI. Email_hint is intentionally
-- omitted (it's PII the carer typed in for their own reference, not
-- something the invitee needs to see again).

CREATE OR REPLACE FUNCTION public.get_invite_preview(invite_token uuid)
  RETURNS TABLE (
    status text,
    household_name text,
    patient_display_name text,
    role public.household_role,
    invited_by_name text,
    expires_at timestamptz,
    accepted_at timestamptz,
    revoked_at timestamptz
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  invite public.household_invites%ROWTYPE;
  resolved_status text;
BEGIN
  SELECT * INTO invite FROM public.household_invites WHERE token = invite_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'not_found'::text,
      NULL::text,
      NULL::text,
      NULL::public.household_role,
      NULL::text,
      NULL::timestamptz,
      NULL::timestamptz,
      NULL::timestamptz;
    RETURN;
  END IF;

  IF invite.revoked_at IS NOT NULL THEN
    resolved_status := 'revoked';
  ELSIF invite.accepted_at IS NOT NULL THEN
    resolved_status := 'accepted';
  ELSIF invite.expires_at < now() THEN
    resolved_status := 'expired';
  ELSE
    resolved_status := 'active';
  END IF;

  RETURN QUERY
    SELECT
      resolved_status,
      h.name,
      h.patient_display_name,
      invite.role,
      coalesce(p.display_name, ''),
      invite.expires_at,
      invite.accepted_at,
      invite.revoked_at
    FROM public.households h
    LEFT JOIN public.profiles p ON p.id = invite.invited_by
    WHERE h.id = invite.household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_invite_preview(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(uuid) TO anon, authenticated;

-- ─── update a member's role ──────────────────────────────────────────
-- Primary-carer-only mutation. Refuses to demote the last primary_carer
-- so a household can never end up admin-less. Idempotent: setting a
-- member to the role they already have is a no-op.

CREATE OR REPLACE FUNCTION public.update_member_role(
  target_household uuid,
  target_user uuid,
  new_role public.household_role
)
  RETURNS public.household_role
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_role public.household_role;
  existing_role public.household_role;
  remaining_primaries integer;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT role INTO caller_role
  FROM public.household_memberships
  WHERE household_id = target_household AND user_id = caller;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  IF caller_role <> 'primary_carer' THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  SELECT role INTO existing_role
  FROM public.household_memberships
  WHERE household_id = target_household AND user_id = target_user;

  IF existing_role IS NULL THEN
    RAISE EXCEPTION 'target_not_a_member';
  END IF;

  -- No-op when the role is already correct.
  IF existing_role = new_role THEN
    RETURN existing_role;
  END IF;

  -- Demoting the last primary_carer would orphan the household.
  IF existing_role = 'primary_carer' AND new_role <> 'primary_carer' THEN
    SELECT count(*)::integer INTO remaining_primaries
    FROM public.household_memberships
    WHERE household_id = target_household AND role = 'primary_carer';
    IF remaining_primaries <= 1 THEN
      RAISE EXCEPTION 'last_primary_carer';
    END IF;
  END IF;

  UPDATE public.household_memberships
  SET role = new_role
  WHERE household_id = target_household AND user_id = target_user;

  RETURN new_role;
END;
$$;

REVOKE ALL ON FUNCTION public.update_member_role(uuid, uuid, public.household_role) FROM public;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.household_role) TO authenticated;

-- ─── extend an invite's expiry ───────────────────────────────────────
-- Bumps `expires_at` to now() + days_to_add days. Refuses on
-- already-accepted or revoked invites. Default extension matches the
-- 14-day initial expiry.

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
  IF caller_role <> 'primary_carer' THEN
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

REVOKE ALL ON FUNCTION public.extend_invite_expiry(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.extend_invite_expiry(uuid, integer) TO authenticated;

-- Force PostgREST to refresh its schema cache so the freshly-installed
-- functions are callable without a server restart.
NOTIFY pgrst, 'reload schema';
