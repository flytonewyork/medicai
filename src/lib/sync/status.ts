import { pendingSyncCount } from "./queue";
import { isSupabaseConfigured } from "~/lib/supabase/client";

const LAST_PULLED_KEY = "anchor.lastPulledAt";

export interface SyncStatus {
  configured: boolean;
  pending: number;
  lastPulledAt: string | null;
  online: boolean;
}

export function readSyncStatus(): SyncStatus {
  const online =
    typeof navigator !== "undefined" ? navigator.onLine : true;
  const lastPulledAt =
    typeof window !== "undefined"
      ? window.localStorage.getItem(LAST_PULLED_KEY)
      : null;

  return {
    configured: isSupabaseConfigured(),
    pending: pendingSyncCount(),
    lastPulledAt,
    online,
  };
}
