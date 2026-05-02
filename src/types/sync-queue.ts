import type { SyncedTable } from "~/lib/sync/tables";

// One row per pending push to `cloud_rows`. Replaces the in-memory FIFO
// that lost ops on tab close while bootstrap was stalled.
//
// `data` is the snapshot of the Dexie row at enqueue time (after
// `scrubForSync`); it's the payload that lands in cloud_rows.data.
// `null` for delete ops.
export interface SyncQueueRow {
  id?: number;
  kind: "upsert" | "delete";
  table: SyncedTable;
  local_id: number;
  data: Record<string, unknown> | null;
  enqueued_at: string;
}
