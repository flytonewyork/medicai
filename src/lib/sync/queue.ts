import { db } from "~/lib/db/dexie";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { nowISO } from "~/lib/utils/date";
import { getCachedHouseholdId, refreshHouseholdId } from "./household-context";
import type { SyncedTable } from "./tables";
import type { SyncQueueRow } from "~/types/sync-queue";

export type SyncOp =
  | { kind: "upsert"; table: SyncedTable; local_id: number; data: unknown }
  | { kind: "delete"; table: SyncedTable; local_id: number };

// Each pending op carries its Dexie queue row id so the worker can
// delete the durable row after a successful push without scanning.
interface PendingOp {
  queue_id: number;
  op: SyncOp;
}

// Dexie is the source of truth. The in-memory mirror is only an index
// so the worker doesn't re-read the table on every drain attempt;
// `restoreQueueFromDexie()` rebuilds it on first use, and every
// enqueue both writes Dexie and pushes onto this array.
const pending: PendingOp[] = [];
let restored = false;
let restorePromise: Promise<void> | null = null;
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

// Reads any queued rows persisted from a previous session and seeds the
// in-memory queue. Idempotent — first call does the read, subsequent
// calls await the same promise.
export function restoreQueueFromDexie(): Promise<void> {
  if (restored) return Promise.resolve();
  if (restorePromise) return restorePromise;
  restorePromise = (async () => {
    const rows = await db.sync_queue.orderBy("id").toArray();
    for (const row of rows) {
      if (row.id == null) continue;
      pending.push({ queue_id: row.id, op: rowToOp(row) });
    }
    restored = true;
  })();
  return restorePromise;
}

function rowToOp(row: SyncQueueRow): SyncOp {
  if (row.kind === "delete") {
    return { kind: "delete", table: row.table, local_id: row.local_id };
  }
  return {
    kind: "upsert",
    table: row.table,
    local_id: row.local_id,
    data: row.data ?? {},
  };
}

// Synchronous-callable enqueue. Persists the op to Dexie asynchronously,
// then mirrors into the in-memory queue and kicks the worker. The Dexie
// hooks that fire enqueueSync don't await — that's deliberate, the
// durable write happens off the Dexie hook's transaction.
//
// The in-memory `pending` only gets a push when restoration has
// already completed. Before restoration runs (first session, fresh
// page load) the upcoming `restoreQueueFromDexie()` will pick the
// just-written row up — pushing here too would duplicate it.
export function enqueueSync(op: SyncOp): void {
  if (suppressed > 0) return;
  void (async () => {
    try {
      const queue_id = await db.sync_queue.add({
        kind: op.kind,
        table: op.table,
        local_id: op.local_id,
        data: op.kind === "upsert" ? (op.data as Record<string, unknown>) : null,
        enqueued_at: new Date().toISOString(),
      });
      if (queue_id == null) return;
      if (restored) {
        pending.push({ queue_id, op });
      }
      void processQueue();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[sync] failed to persist queue op:", err);
    }
  })();
}

export function pendingSyncCount(): number {
  return pending.length;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  await restoreQueueFromDexie();
  if (pending.length === 0) return;

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
    // No household yet — can't satisfy RLS. Hold the ops; the bootstrap
    // path will create the household, and the retry timer will pick
    // up where we left off.
    return;
  }

  processing = true;
  try {
    while (pending.length > 0) {
      const head = pending[0];
      try {
        if (head.op.kind === "upsert") {
          const { error } = await supabase.from("cloud_rows").upsert(
            {
              table_name: head.op.table,
              local_id: head.op.local_id,
              data: head.op.data,
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
            .eq("table_name", head.op.table)
            .eq("local_id", head.op.local_id)
            .eq("household_id", householdId);
          if (error) throw error;
        }
        // Success — remove the durable row + the in-memory mirror.
        await db.sync_queue.delete(head.queue_id);
        pending.shift();
      } catch (err) {
        // Write failed (offline, RLS denied, network). Stop draining and
        // leave the op at the head so the next tick retries it.
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
  // Seed the in-memory mirror from Dexie at startup so previously
  // persisted ops resume on the next tick even if no fresh enqueue
  // arrives.
  void restoreQueueFromDexie().then(() => {
    if (pending.length > 0) void processQueue();
  });
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
  restored = false;
  restorePromise = null;
}

// Forces a drain attempt — used by bootstrap-heal once the household
// id resolves so the patient's first cycle of pending writes flush
// without waiting for the 15-second retry timer.
export function kickQueue(): void {
  void processQueue();
}
