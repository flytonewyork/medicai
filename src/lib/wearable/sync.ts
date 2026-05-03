// Wearable sync — reads from a HealthConnectClient and writes to the
// Dexie `wearable_observations` table.
//
// Idempotent: the row id is `${source}:${metric_id}:${date}` so the
// same observation imported twice is the same row, not two. Updates
// are applied unless the row carries `manual_override === true`, in
// which case the wearable value is skipped (the patient or Thomas
// has the final say).
//
// Pure-ish — Dexie writes happen via an injected `db` reference so
// tests run against fake-indexeddb without touching the real instance.
import type { Table } from "dexie";
import type {
  WearableMetricKind,
  WearableObservation,
  WearableSyncResult,
  WearableSyncWindow,
} from "~/types/wearable";
import type { HealthConnectClient } from "./types";

export interface WearableSyncDeps {
  client: HealthConnectClient;
  table: Table<WearableObservation, string>;
  /** Deterministic clock — tests pin this. */
  now: () => string;
}

/**
 * Run one sync tick: read the requested window from the client, then
 * upsert each observation into Dexie, respecting `manual_override`.
 *
 * Returns counts of inserted/updated/skipped ids. Errors during the
 * client read are caught and surfaced via `error` so the caller can
 * decide whether to schedule a retry.
 */
export async function syncWearableObservations(
  window: WearableSyncWindow,
  deps: WearableSyncDeps,
): Promise<WearableSyncResult> {
  const { client, table, now } = deps;
  const result: WearableSyncResult = {
    inserted: [],
    updated: [],
    skipped_manual: [],
  };

  let observations: WearableObservation[];
  try {
    observations = await client.readDaily(window);
  } catch (err) {
    result.error =
      err instanceof Error ? err.message : "wearable sync failed";
    return result;
  }

  for (const obs of observations) {
    const existing = await table.get(obs.id);
    if (existing?.manual_override) {
      result.skipped_manual.push(obs.id);
      continue;
    }
    const writeRow: WearableObservation = {
      ...obs,
      created_at: existing?.created_at ?? obs.created_at ?? now(),
    };
    if (existing) {
      // Only overwrite the value-bearing fields; preserve created_at
      // and any future metadata Dexie has but our wearable observation
      // doesn't carry.
      await table.update(obs.id, {
        value: writeRow.value,
        unit: writeRow.unit,
        recorded_at: writeRow.recorded_at,
        source_device: writeRow.source_device,
        confidence: writeRow.confidence,
      });
      result.updated.push(obs.id);
    } else {
      await table.put(writeRow);
      result.inserted.push(obs.id);
    }
  }

  return result;
}

/**
 * Convenience: build the deterministic id used for a wearable
 * observation row. Tests + the mock client share this so id
 * generation stays in one place.
 */
export function wearableObservationId(args: {
  source_device: string;
  metric_id: WearableMetricKind;
  date: string;
}): string {
  return `${args.source_device}:${args.metric_id}:${args.date}`;
}
