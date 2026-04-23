-- Anchor Slice A — household foundation + profiles
--
-- Moves the Supabase schema from shared-single-account to per-user
-- identity inside a household. Every carer signs in as themselves and
-- sees dad's data via `household_memberships`. The existing
-- `cloud_rows` table picks up a nullable `household_id` column (tagged
-- by the client on push; RLS scoping lands in Slice B).
--
-- Run in the Supabase SQL editor. Idempotent: uses IF NOT EXISTS and
-- DROP POLICY IF EXISTS throughout so reruns are safe.

-- ─── profiles ────────────────────────────────────────────────────────
-- One row per auth user. Created on signup via trigger (below).

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  locale text NOT NULL DEFAULT 'en',
  care_role_label text,            -- free-text "Son", "Wife", "Oncology Nurse"
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row whenever a new auth.users row appears.
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── households ──────────────────────────────────────────────────────
-- One row per patient. The `created_by` user is automatically made a
-- primary_carer via the `household_memberships` insert below.

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                       -- "Hu family" — freetext
  patient_display_name text NOT NULL,       -- "Hu Lin"
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS households_set_updated_at ON public.households;
CREATE TRIGGER households_set_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── household_memberships ──────────────────────────────────────────
-- Join table: who belongs to which household, with what role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_role') THEN
    CREATE TYPE public.household_role AS ENUM (
      'primary_carer',  -- can invite, remove, change roles
      'family',         -- full read/write; no admin actions
      'clinician',      -- read/write scoped to clinical data (reserved; same as family for now)
      'observer'        -- read-only (reserved; enforcement in Slice B)
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.household_memberships (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.household_role NOT NULL DEFAULT 'family',
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS household_memberships_user_idx
  ON public.household_memberships (user_id);

-- ─── household_invites ───────────────────────────────────────────────
-- A primary carer generates an invite for a specific role. The
-- invitee follows the shareable link (/invite/<token>), signs up (or
-- signs in), and the server-side RPC function below creates a
-- membership for them.

CREATE TABLE IF NOT EXISTS public.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  email_hint text,
  role public.household_role NOT NULL DEFAULT 'family',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS household_invites_household_idx
  ON public.household_invites (household_id);
CREATE INDEX IF NOT EXISTS household_invites_token_idx
  ON public.household_invites (token);

-- ─── cloud_rows gets a household_id ─────────────────────────────────
-- Nullable for now; Slice B scopes RLS to it and makes it NOT NULL.

ALTER TABLE public.cloud_rows
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);

CREATE INDEX IF NOT EXISTS cloud_rows_household_id_idx
  ON public.cloud_rows (household_id);

-- ─── helper functions ────────────────────────────────────────────────

-- Returns the current user's (only) household id, or NULL if none.
-- Used by RLS policies so they stay a single USING clause. The
-- codebase assumes one household per user for now; if that changes,
-- this function and its callers grow a household-selector cookie.
CREATE OR REPLACE FUNCTION public.current_household_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT household_id FROM public.household_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Accepts an invite token, atomically creates a membership for the
-- current user, and marks the invite accepted. Errors if the invite
-- is expired, revoked, already accepted, or doesn't exist.
CREATE OR REPLACE FUNCTION public.accept_household_invite(invite_token uuid)
  RETURNS uuid   -- the household_id the user joined
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  invite public.household_invites%ROWTYPE;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO invite FROM public.household_invites WHERE token = invite_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;
  IF invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_accepted';
  END IF;
  IF invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  INSERT INTO public.household_memberships (household_id, user_id, role, invited_by)
  VALUES (invite.household_id, current_user_id, invite.role, invite.invited_by)
  ON CONFLICT (household_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.household_invites
  SET accepted_by = current_user_id, accepted_at = now()
  WHERE id = invite.id;

  RETURN invite.household_id;
END;
$$;

-- Creates a household and immediately enrols the current user as
-- primary_carer. Returns the new household id.
CREATE OR REPLACE FUNCTION public.create_household(
  household_name text,
  patient_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_household_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  INSERT INTO public.households (name, patient_display_name, created_by)
  VALUES (household_name, patient_name, current_user_id)
  RETURNING id INTO new_household_id;

  INSERT INTO public.household_memberships (household_id, user_id, role, invited_by)
  VALUES (new_household_id, current_user_id, 'primary_carer', current_user_id);

  RETURN new_household_id;
END;
$$;

-- ─── row level security ──────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- Profiles: read any profile you share a household with; update only your own.
DROP POLICY IF EXISTS "profiles read (same household)" ON public.profiles;
CREATE POLICY "profiles read (same household)"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_memberships m1
      JOIN public.household_memberships m2 USING (household_id)
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Households: members can read; primary_carer can update.
DROP POLICY IF EXISTS "households read (members)" ON public.households;
CREATE POLICY "households read (members)"
  ON public.households FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.households.id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "households update (primary)" ON public.households;
CREATE POLICY "households update (primary)"
  ON public.households FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.households.id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

-- Memberships: members can read the list; primary_carer can insert/delete.
-- Self-deletion (leaving) is allowed for anyone.
DROP POLICY IF EXISTS "memberships read (same household)" ON public.household_memberships;
CREATE POLICY "memberships read (same household)"
  ON public.household_memberships FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "memberships insert (primary)" ON public.household_memberships;
CREATE POLICY "memberships insert (primary)"
  ON public.household_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_memberships.household_id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

DROP POLICY IF EXISTS "memberships delete (self or primary)" ON public.household_memberships;
CREATE POLICY "memberships delete (self or primary)"
  ON public.household_memberships FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.household_memberships m
      WHERE m.household_id = public.household_memberships.household_id
        AND m.user_id = auth.uid()
        AND m.role = 'primary_carer'
    )
  );

-- Invites: members of the household can read (so they can list pending);
-- only primary_carer can create or revoke. The accept RPC above is
-- security-definer and bypasses these for the accept path.
DROP POLICY IF EXISTS "invites read (household members)" ON public.household_invites;
CREATE POLICY "invites read (household members)"
  ON public.household_invites FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invites insert (primary)" ON public.household_invites;
CREATE POLICY "invites insert (primary)"
  ON public.household_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_invites.household_id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

DROP POLICY IF EXISTS "invites update (primary)" ON public.household_invites;
CREATE POLICY "invites update (primary)"
  ON public.household_invites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_invites.household_id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

-- cloud_rows RLS stays permissive in this slice. Slice B rewires it to
-- `household_id = current_household_id()`.

-- ─── realtime ────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
