import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { pullFromCloud } from "./pull";

let channel: RealtimeChannel | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Subscribe to cloud_rows changes. When any row changes we debounce a pull so
// Tom's device sees dad's updates within ~1s without hammering Supabase.
export function subscribeToCloudChanges(): void {
  if (channel) return;
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  channel = supabase
    .channel("cloud_rows_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cloud_rows" },
      () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void pullFromCloud();
        }, 500);
      },
    )
    .subscribe();
}

export function unsubscribeFromCloudChanges(): void {
  if (!channel) return;
  const supabase = getSupabaseBrowser();
  if (supabase) {
    void supabase.removeChannel(channel);
  }
  channel = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
