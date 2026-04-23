import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { pullFromCloud } from "./pull";
import {
  getCachedHouseholdId,
  onHouseholdChange,
  refreshHouseholdId,
} from "./household-context";

let channel: RealtimeChannel | null = null;
let subscribedHouseholdId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let householdUnsub: (() => void) | null = null;

// Subscribe to cloud_rows changes scoped to the current user's
// household. When any row changes we debounce a pull so other
// household members see updates within ~1s without hammering
// Supabase. Re-subscribes automatically when the household id
// changes (sign-in / sign-out / join).
export function subscribeToCloudChanges(): void {
  if (householdUnsub) return;       // already wired
  void ensureSubscription();
  householdUnsub = onHouseholdChange(() => {
    void ensureSubscription();
  });
}

async function ensureSubscription(): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  let householdId = getCachedHouseholdId();
  if (!householdId) {
    householdId = await refreshHouseholdId();
  }

  // Subscribe only if the household changed (or we have none yet).
  if (householdId === subscribedHouseholdId && channel) return;

  // Tear down any existing channel first.
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
    subscribedHouseholdId = null;
  }
  if (!householdId) return;

  channel = supabase
    .channel(`cloud_rows:${householdId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cloud_rows",
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void pullFromCloud();
        }, 500);
      },
    )
    .subscribe();
  subscribedHouseholdId = householdId;
}

export function unsubscribeFromCloudChanges(): void {
  const supabase = getSupabaseBrowser();
  if (channel && supabase) {
    void supabase.removeChannel(channel);
  }
  channel = null;
  subscribedHouseholdId = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (householdUnsub) {
    householdUnsub();
    householdUnsub = null;
  }
}
