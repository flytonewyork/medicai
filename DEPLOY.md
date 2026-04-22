# Shipping Anchor

End-to-end instructions to get Anchor live on a URL, with cloud persistence
and login, so dad can use it on his phone and Tom can see the same data.

## 1. Supabase project (10 min)

1. Go to https://supabase.com → **New project**.
2. Name it `anchor`, pick any region (Sydney if available), set a strong
   database password (you won't need it day-to-day).
3. Once the project finishes provisioning, open **SQL Editor** → **New query**.
4. Paste the contents of `supabase/schema.sql` from this repo and **Run**.
   You should see the `cloud_rows` table in **Table Editor**.
5. **Authentication → Providers**: make sure **Email** is enabled. For the
   fastest flow turn **OFF** "Confirm email" (Authentication → Settings →
   Email Auth → Confirm email). We can turn it back on later.
6. **Authentication → URL Configuration**:
   - Site URL: `https://<your-vercel-domain>` (paste this after step 3 below)
   - Redirect URLs: add `https://<your-vercel-domain>/auth/callback`
7. **Authentication → Users → Add user**:
   - `hulin.melb@hotmail.com` with a simple password dad will remember
   - `thomas.findoasis@gmail.com` with your password

Copy from **Project Settings → API**:
- Project URL (`https://xxx.supabase.co`)
- `anon` / `publishable` key

## 2. Environment variables

Local dev already has a `.env.local` pointing at the Supabase project. For
production, set the same two keys in Vercel (step 3).

```
NEXT_PUBLIC_SUPABASE_URL=https://tzmxmknkccxbvjhfvsdy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_7TeUX3uaUaeL3oqCx7oHdA_Ub0P6Buw
```

### Claude Code MCP (developer machines only)

`.mcp.json` configures the Supabase MCP server so Claude Code can query the
database directly during development. It reads a PAT from the environment:

1. Go to https://supabase.com/dashboard/account/tokens → **Generate new token**.
2. Name it `anchor-dev` and copy the token.
3. Add it to your local `.env.local`:
   ```
   SUPABASE_PAT=sbp_xxxxxxxxxxxxxxxxxxxx
   ```
4. Reload Claude Code (or run `claude /mcp` to confirm the server connects).

This variable is only needed on developer machines and is never used in
production. Do not add `SUPABASE_PAT` to Vercel.

## 3. Vercel deploy (5 min)

1. Go to https://vercel.com → **Add new → Project** → import
   `flytonewyork/medicai`.
2. Framework preset: **Next.js** (auto-detected).
3. Under **Environment Variables**, add the two `NEXT_PUBLIC_SUPABASE_*`
   entries above. Scope: *Production, Preview, Development*.
4. Click **Deploy**. First build takes ~2 min.
5. Once deployed, copy the production URL (e.g.
   `https://medicai-xxxxx.vercel.app`) and paste it back into Supabase →
   Authentication → URL Configuration (see step 1.6).

## 4. First-run smoke test

1. Visit the production URL → you land on `/login`.
2. Sign in with `hulin.melb@hotmail.com` + dad's password.
3. Complete onboarding (name, diagnosis date, baselines).
4. Do a daily check-in.
5. Sign out, sign back in as `thomas.findoasis@gmail.com`.
6. You should see the same onboarding data + check-in dad just entered.
   If not, open the browser console — the sync layer logs warnings.

## 5. How the sync works (for future debugging)

- Local reads go through Dexie/IndexedDB as before (fast, offline-safe).
- Every Dexie write fires a hook that pushes a row into Supabase
  `cloud_rows` keyed by `(table_name, local_id)`.
- The app subscribes to `cloud_rows` Realtime changes and pulls any new
  rows into Dexie. That's how Tom sees dad's updates within ~1 second.
- If the network drops, writes queue in memory and retry every 15 s.
- Pull cursor (`anchor.lastPulledAt`) lives in `localStorage`; clearing
  browser storage forces a full re-pull on next sign-in.

## 6. Known limitations (intentional, ship-first)

- Two users writing the same Dexie table at the same moment can collide
  on `local_id`. Dad is the primary writer; Tom is mostly a reader. If we
  see collisions we'll switch to UUID primary keys per row.
- No server-side validation — all constraints live in the Zod schemas
  client-side. Acceptable because only dad and Tom have credentials.
- No end-to-end encryption. Data sits in plaintext in Supabase. Per the
  user's instruction, the collected data is not considered sensitive.

## 7. Future hardening (not blocking launch)

- Turn on email confirmation in Supabase.
- Add per-user audit trail (`user_id` column on `cloud_rows`).
- Migrate to UUID primary keys if multi-writer conflicts appear.
- Enable Supabase backups on a schedule.
