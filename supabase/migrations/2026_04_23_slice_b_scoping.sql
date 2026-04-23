-- Anchor Slice B — cloud_rows scoped by household_id
--
-- Slice A added a nullable `household_id` column to cloud_rows. This
-- migration:
--   (1) Backfills any legacy row (household_id IS NULL) with the one
--       existing household — safe because prior deployments were
--       single-account single-household.
--   (2) Makes household_id NOT NULL.
--   (3) Replaces the permissive "authenticated sees everything" RLS
--       policies on cloud_rows with policies scoped to the caller's
--       membership.
--
-- Idempotent: reruns are safe.

-- ─── 1. backfill ────────────────────────────────────────────────────
-- Any rows without a household get attached to the single existing
-- household, if one exists. (If there are somehow zero or multiple
-- households, the NOT NULL constraint below will flag it.)

DO $$
DECLARE
  target_household uuid;
  household_count int;
BEGIN
  SELECT count(*) INTO household_count FROM public.households;

  IF household_count = 0 THEN
    RAISE NOTICE 'Slice B: no households exist yet — skipping backfill. Run again after the first household is created.';
    RETURN;
  END IF;

  IF household_count > 1 THEN
    RAISE EXCEPTION 'Slice B backfill refuses to run: % households exist, can''t auto-pick a target. Backfill manually by mapping cloud_rows to their household.', household_count;
  END IF;

  SELECT id INTO target_household FROM public.households LIMIT 1;

  UPDATE public.cloud_rows
    SET household_id = target_household
    WHERE household_id IS NULL;
END$$;

-- ─── 2. NOT NULL ────────────────────────────────────────────────────
-- Only safe once every row has a household. Wrapped so reruns after
-- the constraint is already applied don't blow up.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cloud_rows'
      AND column_name  = 'household_id'
      AND is_nullable  = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.cloud_rows WHERE household_id IS NULL
  ) THEN
    ALTER TABLE public.cloud_rows ALTER COLUMN household_id SET NOT NULL;
  END IF;
END$$;

-- ─── 3. replace permissive RLS with household-scoped RLS ────────────

DROP POLICY IF EXISTS "authenticated read" ON public.cloud_rows;
DROP POLICY IF EXISTS "authenticated insert" ON public.cloud_rows;
DROP POLICY IF EXISTS "authenticated update" ON public.cloud_rows;
DROP POLICY IF EXISTS "authenticated delete" ON public.cloud_rows;

-- A row is visible iff the caller belongs to its household.
CREATE POLICY "cloud_rows read (household member)"
  ON public.cloud_rows FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cloud_rows insert (household member)"
  ON public.cloud_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cloud_rows update (household member)"
  ON public.cloud_rows FOR UPDATE
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cloud_rows delete (household member)"
  ON public.cloud_rows FOR DELETE
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.household_memberships WHERE user_id = auth.uid()
    )
  );
