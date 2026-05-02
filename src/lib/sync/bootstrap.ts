import { db } from "~/lib/db/dexie";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { SYNCED_TABLES, type SyncedTable } from "./tables";
import { scrubForSync } from "./hooks";
import { enqueueSync, kickQueue } from "./queue";
import { refreshHouseholdId, getCachedHouseholdId } from "./household-context";

// Bootstrap heal — fixes the "patient onboarded offline before Supabase
// auth existed" trap that left Hu Lin with `settings.onboarded_at` set
// but no profile, no household, and a sync queue that could never drain
// (queue waits for a household_id, household_id resolution waits for
// onboarding, onboarding bounces because onboarded_at is set).
//
// Runs once per signed-in app load:
//  1. Ensure a `profiles` row exists for the current auth user.
//  2. If the local `settings.user_type` is "patient" (or unset, which
//     covers Hu Lin since he onboarded before user_type existed) AND
//     the user has no household membership yet, create a household
//     using their local `settings.profile_name` as the patient name.
//  3. Refresh the household-id cache so the queue can drain.
//
// Returns the resolved household id, or null if we couldn't bootstrap
// (no auth, no profile_name to seed with, RPC error). Callers should
// continue with whatever they were doing — this function never throws.

const FLUSH_FLAG_KEY = "anchor.bootstrapFlushed_v1";

export async function bootstrapHouseholdAndProfile(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const sb = getSupabaseBrowser();
  if (!sb) return null;

  try {
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return null;

    // Lazy import to keep the sync module's hot path off the larger
    // households helper graph until bootstrap actually runs.
    const {
      ensureProfileForCurrentUser,
      ensureHouseholdForCurrentUser,
      getCurrentMembership,
    } = await import("~/lib/supabase/households");

    const settings = (await db.settings.toArray())[0] ?? null;

    // Step 1 — profile. Idempotent upsert; safe even if `handle_new_user`
    // ran cleanly on signup. Catch and continue: a profile failure
    // should not block household creation, since RLS on cloud_rows
    // doesn't depend on profile existence.
    try {
      await ensureProfileForCurrentUser({
        displayName: settings?.profile_name?.trim() || undefined,
        locale: settings?.locale,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[bootstrap] ensureProfileForCurrentUser failed:", err);
    }

    // Step 2 — household. Only auto-create for patients, and only when
    // we have a name to seed with. Caregivers / clinicians who reach
    // here without a membership joined via invite or picker — they
    // should never auto-create a household for themselves.
    const userType = settings?.user_type;
    const isPatient = userType === "patient" || !userType;
    const patientName = settings?.profile_name?.trim();

    if (isPatient && patientName) {
      try {
        const existing = await getCurrentMembership();
        if (!existing) {
          await ensureHouseholdForCurrentUser({ patientName });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[bootstrap] ensureHouseholdForCurrentUser failed:",
          err,
        );
      }
    }

    // Step 3 — re-resolve the household id so the queue worker can
    // drain on its next tick.
    const householdId = await refreshHouseholdId();
    return householdId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bootstrap] unexpected failure:", err);
    return null;
  }
}

// Force-flush every local row in every synced table to cloud_rows. Runs
// once per device, gated by the localStorage flag below. Targets the
// specific recovery scenario where a device has accumulated days of
// offline / failed-sync local data that never landed in cloud_rows
// (Hu Lin's April-23-RLS-bug situation). Idempotent on the cloud side
// because cloud_rows uses `(table_name, local_id)` as the upsert key —
// re-running flush on the same data overwrites with itself.
//
// Skips silently if:
//   - already flushed on this device (flag set)
//   - no household is resolved yet (queue can't drain anyway)
//
// We don't catch and clear the flag on failure: if a single row's
// enqueue fails the queue itself will retry (it's persistent now), so
// we mark the flush done and let the queue worker handle the rest.
export async function flushLocalRowsOnce(): Promise<{
  flushed: boolean;
  rows: number;
}> {
  if (typeof window === "undefined") return { flushed: false, rows: 0 };
  if (window.localStorage.getItem(FLUSH_FLAG_KEY) === "yes") {
    return { flushed: false, rows: 0 };
  }
  const householdId = getCachedHouseholdId();
  if (!householdId) return { flushed: false, rows: 0 };

  let total = 0;
  for (const tableName of SYNCED_TABLES) {
    const table = (db as unknown as Record<
      string,
      { toArray?: () => Promise<unknown[]> } | undefined
    >)[tableName];
    if (!table?.toArray) continue;
    let rows: unknown[];
    try {
      rows = await table.toArray();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[bootstrap] flush: read failed for ${tableName}:`, err);
      continue;
    }
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as { id?: number };
      if (typeof r.id !== "number") continue;
      const data = scrubForSync(tableName as SyncedTable, r as object);
      enqueueSync({
        kind: "upsert",
        table: tableName as SyncedTable,
        local_id: r.id,
        data,
      });
      total += 1;
    }
  }

  window.localStorage.setItem(FLUSH_FLAG_KEY, "yes");
  // Wake the worker so the burst of fresh enqueues drains immediately
  // rather than waiting for the 15-second retry tick.
  kickQueue();
  return { flushed: true, rows: total };
}

// Test-only reset for the flush flag.
export function __resetFlushFlagForTests(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FLUSH_FLAG_KEY);
}
