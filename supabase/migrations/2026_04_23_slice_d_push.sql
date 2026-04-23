-- Anchor Slice D — push subscription storage
--
-- One row per (user, device). The morning-digest cron (Slice E) iterates
-- these rows per household and fans out notifications via web-push.
-- RLS: users only see + mutate their own subscriptions. Cron uses the
-- service-role key to read all rows in a household's members.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  locale text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_pushed_at timestamptz,
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions read own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions read own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions insert own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions insert own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions delete own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions delete own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Update allowed for own rows so the cron's own-row last_pushed_at
-- bookkeeping works from the service-role client AND users can update
-- their own locale preference.
DROP POLICY IF EXISTS "push_subscriptions update own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions update own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
