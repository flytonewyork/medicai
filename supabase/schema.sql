-- Anchor cloud schema
-- Run this in the Supabase SQL editor after creating a new project.
-- See DEPLOY.md for step-by-step.
--
-- Strategy: a generic `cloud_rows` table mirrors every Dexie table.
-- Each row is keyed by (table_name, local_id) where local_id is the Dexie
-- auto-increment id. The full row is stored as jsonb in `data`.
-- This avoids per-table column mapping for 24 Dexie tables and lets the
-- schema evolve without migrations.

CREATE TABLE IF NOT EXISTS public.cloud_rows (
  table_name text NOT NULL,
  local_id bigint NOT NULL,
  data jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, local_id)
);

CREATE INDEX IF NOT EXISTS cloud_rows_updated_at_idx
  ON public.cloud_rows (updated_at DESC);

CREATE INDEX IF NOT EXISTS cloud_rows_table_name_idx
  ON public.cloud_rows (table_name);

-- Auto-bump updated_at on any UPDATE so incremental pulls stay correct.
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cloud_rows_set_updated_at ON public.cloud_rows;
CREATE TRIGGER cloud_rows_set_updated_at
  BEFORE UPDATE ON public.cloud_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row level security: any authenticated user sees everything.
-- This matches the family-shared model (dad + Tom both authenticated, both
-- see the same data pool). Anonymous users have zero access.
ALTER TABLE public.cloud_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON public.cloud_rows;
CREATE POLICY "authenticated read"
  ON public.cloud_rows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated insert" ON public.cloud_rows;
CREATE POLICY "authenticated insert"
  ON public.cloud_rows FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated update" ON public.cloud_rows;
CREATE POLICY "authenticated update"
  ON public.cloud_rows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated delete" ON public.cloud_rows;
CREATE POLICY "authenticated delete"
  ON public.cloud_rows FOR DELETE
  TO authenticated
  USING (true);

-- Realtime: enable so the app can subscribe to changes (Tom sees dad's logs).
-- ALTER PUBLICATION ... ADD TABLE isn't idempotent — running it twice errors
-- 42710. Wrap in a DO block so re-running schema.sql against an existing
-- project (e.g. when a fresh contributor is bootstrapping) doesn't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cloud_rows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cloud_rows;
  END IF;
END$$;


-- ═══════════════════════════════════════════════════════════════════
-- Slice A — household foundation + profiles.
-- Source of truth: supabase/migrations/2026_04_23_slice_a_households.sql
-- For new installs: the migration file is run after this schema.sql
-- via the Supabase CLI. For the consolidated view, read that file.
-- ═══════════════════════════════════════════════════════════════════
