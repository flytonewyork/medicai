import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { attachSyncHooks } from "./hooks";
import { pullFromCloud, resetPullCursor } from "./pull";
import { startSyncRetryTimer, stopSyncRetryTimer } from "./queue";
import { subscribeToCloudChanges, unsubscribeFromCloudChanges } from "./realtime";
import { refreshHouseholdId } from "./household-context";
import { bootstrapHouseholdAndProfile, flushLocalRowsOnce } from "./bootstrap";
import { wireUserIdCache } from "~/lib/supabase/current-user";

let initialized = false;

// Call once on app mount (client-side). Safe to call multiple times.
// - Installs Dexie write hooks so future local writes push to Supabase
// - If the user is authenticated, pulls cloud rows into Dexie
// - Subscribes to realtime changes so Tom sees dad's updates live
// - Reacts to auth state changes (sign in → pull + subscribe;
//   sign out → stop subscription and reset pull cursor)
export async function initSync(): Promise<void> {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

  initialized = true;

  attachSyncHooks();
  startSyncRetryTimer();
  wireUserIdCache();

  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Bootstrap heal — auto-create profile + household for users who
    // onboarded offline before Supabase auth existed (Hu Lin). No-op
    // for users who already have a household. Always runs before the
    // pull so the pull has a household_id to scope by.
    await bootstrapHouseholdAndProfile();
    await pullFromCloud();
    subscribeToCloudChanges();
    // Force-flush local Dexie → cloud once per device. Idempotent on
    // cloud side (upsert on table_name+local_id). Targets the
    // April-23-RLS recovery: any device that had accumulated local
    // writes during the broken-sync window flushes them on next load.
    void flushLocalRowsOnce();
  }

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      await bootstrapHouseholdAndProfile();
      await pullFromCloud();
      subscribeToCloudChanges();
      void flushLocalRowsOnce();
    } else if (event === "SIGNED_OUT") {
      unsubscribeFromCloudChanges();
      // Next sign-in triggers a fresh full pull so we see all cloud data.
      resetPullCursor();
      await refreshHouseholdId();
    }
  });

  // Drain queue on reconnect — the retry timer already handles periodic
  // retries, but this catches the immediate case where the user comes back
  // online mid-session.
  window.addEventListener("online", () => {
    void pullFromCloud();
  });
}

export function shutdownSync(): void {
  stopSyncRetryTimer();
  unsubscribeFromCloudChanges();
}
