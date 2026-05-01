import { getSupabaseBrowser } from "~/lib/supabase/client";
import { nowISO } from "~/lib/utils/date";
import { getCachedHouseholdId, refreshHouseholdId } from "./household-context";
import type { SyncedTable } from "./tables";

export type SyncOp =
  | { kind: "upsert"; table: SyncedTable; local_id: number; data: unknown }
  | { kind: "delete"; table: SyncedTable; local_id: number };

// In-memory FIFO queue. Cleared by processQueue on success; survives in-memory
// across hook calls within a tab. If Supabase writes fail (offline), the ops
// stay in the queue and retry happens on the next push.
const pending: SyncOp[] = [];
let processing = false;

// When pulling from the cloud we suppress the push hooks so we don't echo
// incoming rows straight back to the server.
let suppressed = 0;

export function isSyncSuppressed(): boolean {
  return suppressed > 0;
}

export async function withSyncSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressed += 1;
  try {
    return await fn();
  } finally {
    suppressed -= 1;
  }
}

export function enqueueSync(op: SyncOp): void {
  if (suppressed > 0) return;
  pending.push(op);
  void processQueue();
}

export function pendingSyncCount(): number {
  return pending.length;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  // Slice B: tag every push with the current user's household_id so
  // RLS can scope reads to the family. If we don't know the household
  // yet (fresh sign-in, brand-new signup pre-create_household), try
  // to resolve it now; if still unknown, leave the queue intact and
  // retry on the next tick.
  let householdId = getCachedHouseholdId();
  if (!householdId) {
    householdId = await refreshHouseholdId();
  }
  if (!householdId) {
    // No household yet — can't satisfy RLS. Hold the ops.
    return;
  }

  processing = true;
  try {
    while (pending.length > 0) {
      const op = pending[0];
      try {
        if (op.kind === "upsert") {
          const { error } = await supabase.from("cloud_rows").upsert(
            {
              table_name: op.table,
              local_id: op.local_id,
              data: op.data,
              deleted: false,
              household_id: householdId,
              updated_at: nowISO(),
            },
            { onConflict: "table_name,local_id" },
          );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("cloud_rows")
            .update({
              deleted: true,
              updated_at: nowISO(),
            })
            .eq("table_name", op.table)
            .eq("local_id", op.local_id)
            .eq("household_id", householdId);
          if (error) throw error;
        }
        pending.shift();
      } catch (err) {
        // Write failed (offline, RLS denied, network). Stop draining and
        // leave the op at the head of the queue so the next tick retries it.
        // eslint-disable-next-line no-console
        console.warn("[sync] push failed, will retry:", err);
        break;
      }
    }
  } finally {
    processing = false;
  }
}

// Periodic retry so queued ops eventually push when the network recovers.
let retryTimer: ReturnType<typeof setInterval> | null = null;

export function startSyncRetryTimer(intervalMs = 15000): void {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    if (pending.length > 0) void processQueue();
  }, intervalMs);
}

export function stopSyncRetryTimer(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

// Test-only helper. Clears the in-memory queue and resets flags so each
// test starts from a clean slate. Never call this from production code.
export function __resetSyncQueueForTests(): void {
  pending.length = 0;
  processing = false;
  suppressed = 0;
}
