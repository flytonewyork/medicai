import { getSupabaseBrowser } from "~/lib/supabase/client";

// The sync layer needs the current user's household_id to tag writes,
// filter pulls, and scope realtime subscriptions. This module keeps a
// cached value + refresh triggers so the rest of the sync code can call
// `getCachedHouseholdId()` synchronously from the queue processor
// without hammering Supabase on every upsert.
//
// Refresh happens:
//   - on module import (first load),
//   - on `supabase.auth.onAuthStateChange` (sign-in / sign-out),
//   - explicitly via `refreshHouseholdId()` from init.ts after pulls.
//
// When the user has no household yet (brand-new signup pre-create,
// or Supabase is unconfigured) we return null and the sync layer
// defers writes into its queue — Slice A's onboarding finish step
// calls `create_household` and a subsequent refresh picks it up.

let cached: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

export function getCachedHouseholdId(): string | null {
  return cached;
}

export function isHouseholdLoaded(): boolean {
  return loaded;
}

export function onHouseholdChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

export async function refreshHouseholdId(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    cached = null;
    loaded = true;
    notify();
    return null;
  }
  try {
    const { data: user } = await sb.auth.getUser();
    const uid = user.user?.id;
    if (!uid) {
      cached = null;
      loaded = true;
      notify();
      return null;
    }
    const { data, error } = await sb
      .from("household_memberships")
      .select("household_id")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const next = (data?.household_id as string | undefined) ?? null;
    if (next !== cached) {
      cached = next;
      notify();
    }
    loaded = true;
    return cached;
  } catch {
    // Leave the previous cache in place on transient failure; the next
    // auth change or scheduled refresh will pick up the right value.
    loaded = true;
    return cached;
  }
}

// Test-only reset so each test starts from a clean cache.
export function __resetHouseholdContextForTests(): void {
  cached = null;
  loaded = false;
  listeners.clear();
}

// Test-only seed so unit tests that exercise queue/pull/realtime don't
// need to mock Supabase just to preload the household id.
export function __setHouseholdIdForTests(id: string | null): void {
  cached = id;
  loaded = true;
}
