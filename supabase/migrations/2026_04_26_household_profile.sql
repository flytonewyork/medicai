-- Anchor — household_profile table
--
-- Externalises the patient identity envelope (initials, diagnosis,
-- clinician names) that was previously baked into system prompts and
-- component defaults as literal strings. One row per household.
-- Deployments that bring up a new household are expected to fill the
-- row after household creation; missing rows fall back to a generic
-- envelope server-side (FALLBACK_HOUSEHOLD_PROFILE in TS).
--
-- RLS: SELECT/UPDATE allowed only for household members. Insert is
-- gated to primary_carer so a caregiver / patient role can't rewrite
-- the diagnosis on Thomas's behalf.

CREATE TABLE IF NOT EXISTS public.household_profile (
  household_id uuid PRIMARY KEY
    REFERENCES public.households(id) ON DELETE CASCADE,
  patient_initials text NOT NULL DEFAULT 'the patient',
  diagnosis_short text NOT NULL DEFAULT 'metastatic pancreatic cancer',
  diagnosis_full text NOT NULL
    DEFAULT 'metastatic pancreatic ductal adenocarcinoma on first-line gemcitabine + nab-paclitaxel',
  oncologist_name text,
  surgeon_name text,
  locale_default text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS household_profile_set_updated_at
  ON public.household_profile;
CREATE TRIGGER household_profile_set_updated_at
  BEFORE UPDATE ON public.household_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.household_profile ENABLE ROW LEVEL SECURITY;

-- Members of the household can read.
DROP POLICY IF EXISTS "household_profile read (members)"
  ON public.household_profile;
CREATE POLICY "household_profile read (members)"
  ON public.household_profile FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_profile.household_id
        AND user_id = auth.uid()
    )
  );

-- Only primary_carer can insert / update.
DROP POLICY IF EXISTS "household_profile insert (primary)"
  ON public.household_profile;
CREATE POLICY "household_profile insert (primary)"
  ON public.household_profile FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_profile.household_id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

DROP POLICY IF EXISTS "household_profile update (primary)"
  ON public.household_profile;
CREATE POLICY "household_profile update (primary)"
  ON public.household_profile FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_memberships
      WHERE household_id = public.household_profile.household_id
        AND user_id = auth.uid()
        AND role = 'primary_carer'
    )
  );

-- Backfill: every existing household gets a default row so the route
-- helper that does `eq("household_id", id).maybeSingle()` finds
-- something. The defaults are deliberately generic — admins should
-- update the row with real values via the settings UI / admin script.
INSERT INTO public.household_profile (household_id)
  SELECT id FROM public.households
  ON CONFLICT (household_id) DO NOTHING;

-- ALTER PUBLICATION ... ADD TABLE isn't idempotent — wrap so re-running
-- this migration doesn't error 42710.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'household_profile'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_profile;
  END IF;
END$$;
