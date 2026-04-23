import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { attachSyncHooks } from "./hooks";
import { pullFromCloud, resetPullCursor } from "./pull";
import { startSyncRetryTimer, stopSyncRetryTimer } from "./queue";
import { subscribeToCloudChanges, unsubscribeFromCloudChanges } from "./realtime";
import { refreshHouseholdId } from "./household-context";

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

  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Slice B: resolve the household id before the first pull so the
    // pull can scope by it. Without a household the pull returns 0
    // rows and we'll try again once onboarding / invite-accept fills
    // in the membership.
    await refreshHouseholdId();
    await pullFromCloud();
    subscribeToCloudChanges();
  }

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      await refreshHouseholdId();
      await pullFromCloud();
      subscribeToCloudChanges();
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
