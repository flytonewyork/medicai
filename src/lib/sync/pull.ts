import { db } from "~/lib/db/dexie";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import { SYNCED_TABLES, type SyncedTable } from "./tables";
import { withSyncSuppressed } from "./queue";
import {
  getCachedHouseholdId,
  refreshHouseholdId,
} from "./household-context";

const LAST_PULLED_KEY = "anchor.lastPulledAt";

interface CloudRow {
  table_name: string;
  local_id: number;
  data: Record<string, unknown> | null;
  deleted: boolean;
  updated_at: string;
}

export async function pullFromCloud(): Promise<{ pulled: number } | null> {
  if (typeof window === "undefined") return null;
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;

  const lastPulledAt =
    window.localStorage.getItem(LAST_PULLED_KEY) ?? "1970-01-01T00:00:00Z";

  // Slice B: scope the pull to the current user's household. Without
  // a household we skip — the user is either signed out or mid-
  // onboarding before create_household runs.
  let householdId = getCachedHouseholdId();
  if (!householdId) {
    householdId = await refreshHouseholdId();
  }
  if (!householdId) return { pulled: 0 };

  // Fetch rows newer than our last pull. Limit to 5000 for safety.
  const { data, error } = await supabase
    .from("cloud_rows")
    .select("table_name,local_id,data,deleted,updated_at")
    .eq("household_id", householdId)
    .gt("updated_at", lastPulledAt)
    .order("updated_at", { ascending: true })
    .limit(5000);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[sync] pull failed:", error);
    return null;
  }

  const rows = (data ?? []) as CloudRow[];
  if (rows.length === 0) return { pulled: 0 };

  const validTables = new Set<string>(SYNCED_TABLES);

  await withSyncSuppressed(async () => {
    for (const row of rows) {
      if (!validTables.has(row.table_name)) continue;
      const table = (db as unknown as Record<string, DexieTableLike | undefined>)[
        row.table_name
      ];
      if (!table) continue;

      try {
        if (row.deleted) {
          await table.delete(row.local_id);
        } else if (row.data && typeof row.data === "object") {
          await table.put({ ...row.data, id: row.local_id });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[sync] apply failed for ${row.table_name}#${row.local_id}`,
          err,
        );
      }
    }
  });

  const latest = rows[rows.length - 1].updated_at;
  window.localStorage.setItem(LAST_PULLED_KEY, latest);
  return { pulled: rows.length };
}

// Structural type for the Dexie operations we call during pull.
type DexieTableLike = {
  put(row: Record<string, unknown>): Promise<number>;
  delete(primKey: number): Promise<void>;
};

export function resetPullCursor(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_PULLED_KEY);
}

// Typeguard to ensure the string matches a table name we know about.
export function isSyncedTable(name: string): name is SyncedTable {
  return (SYNCED_TABLES as readonly string[]).includes(name);
}
