-- Slice M — family collaboration foundation
--
-- (1) adds the `patient` value to the household_role enum so a patient
--     can have their own account in their own household,
-- (2) extends `profiles` with relationship + timezone +
--     notification_preference (richer profile for welcome screens and
--     future nudges).
--
-- Role-specific RLS tightening (write-gated per action) is an explicit
-- follow-up PR; this migration keeps the Slice A / B policies intact.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.household_role'::regtype
      AND enumlabel = 'patient'
  ) THEN
    ALTER TYPE public.household_role ADD VALUE 'patient' AFTER 'primary_carer';
  END IF;
END$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS notification_preference text;

-- `relationship` is freetext ("son", "wife", "oncology nurse",
-- "palliative RN", "research coordinator") so new relations don't
-- need a schema change.
-- `timezone` is an IANA id; client populates from Intl.DateTimeFormat.
-- `notification_preference` is either `'all'`, `'digest'`, or
-- `'emergency_only'` today — kept as text so new values don't
-- require an enum change.
