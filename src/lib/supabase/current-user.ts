"use client";

import { getSupabaseBrowser } from "~/lib/supabase/client";

// Small cached getter for the current signed-in user's auth id, used
// by writers that want to stamp `entered_by_user_id` on their rows.
// We don't expose the whole user object — just the uid — because
// that's the only field the Dexie rows care about. Cached in module
// scope + refreshed on auth state change so repeat calls are cheap.

let cachedUid: string | null = null;
let wired = false;

export function getCachedUserId(): string | null {
  return cachedUid;
}

export async function refreshCachedUserId(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) {
    cachedUid = null;
    return null;
  }
  const { data } = await sb.auth.getUser();
  cachedUid = data.user?.id ?? null;
  return cachedUid;
}

// Install the auth-state subscription once per session so writers don't
// need to call `refreshCachedUserId` themselves on sign-in/out.
export function wireUserIdCache(): void {
  if (wired) return;
  wired = true;
  const sb = getSupabaseBrowser();
  if (!sb) return;
  void refreshCachedUserId();
  sb.auth.onAuthStateChange((_event, session) => {
    cachedUid = session?.user?.id ?? null;
  });
}

// Test-only reset.
export function __resetUserIdCacheForTests(): void {
  cachedUid = null;
  wired = false;
}
