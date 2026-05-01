// Wearable-vs-self-report precedence merge.
//
// Two sources of truth for fields like `steps` and `weight_kg`:
//   1. Daily wizard (manual entry) — patient or carer typed it.
//   2. Wearable Health Connect pull — Oura ring, Withings scale, etc.
//
// Rules:
//   - Wearable value always wins UNLESS the daily entry was manually
//     entered with an explicit non-undefined value AFTER the
//     wearable's `recorded_at`. The patient's last word stands.
//   - For metrics not present on DailyEntry (e.g. RHR, HRV, sleep),
//     the wearable value is the only source — no merge needed.
//   - Manual override on the wearable row itself (Thomas saying "the
//     ring miscounted") is handled at sync time, not here.
//
// Pure function. No Dexie writes — caller decides whether to persist
// the merged DailyEntry.
import type { DailyEntry } from "~/types/clinical";
import type {
  WearableMetricKind,
  WearableObservation,
} from "~/types/wearable";

// Numeric DailyEntry fields a wearable can populate. Restricting to
// numeric fields keeps the type system honest — none of the boolean
// flags or enum fields make sense to overwrite from a wearable.
type NumericDailyField = "steps" | "weight_kg";

// Mapping from wearable metric → DailyEntry field. Only metrics the
// daily wizard captures get auto-filled; everything else flows through
// wearable_observations only and surfaces in the analytical layer.
const DAILY_FIELD_MAP: Partial<Record<WearableMetricKind, NumericDailyField>> = {
  steps: "steps",
  weight_kg: "weight_kg",
};

export interface WearableMergeArgs {
  date: string;                                // ISO YYYY-MM-DD
  daily?: DailyEntry | null;                   // existing entry, if any
  wearable_observations: ReadonlyArray<WearableObservation>;
}

export interface WearableMergeResult {
  /** Patch to apply to the DailyEntry. Empty when no change. */
  patch: Partial<DailyEntry>;
  /** Fields the wearable wanted to fill but the daily entry already
   *  carried a fresher manual value. Surfaced in the clinician dual-
   *  view as a precedence audit, never to the patient. */
  manual_kept: Array<NumericDailyField>;
}

/**
 * Compute the patch the daily entry should receive given today's
 * wearable observations.
 *
 * - When DailyEntry is missing the field entirely → fill from wearable.
 * - When DailyEntry has the field AND `entered_at` is *after* the
 *   wearable's `recorded_at` → keep manual; flag for audit.
 * - When DailyEntry has the field AND `entered_at` is *before* the
 *   wearable's `recorded_at` → wearable wins (newer evidence).
 *
 * If multiple wearable observations cover the same metric (e.g. Oura
 * AND phone both report steps), the most recently-recorded one wins.
 */
export function mergeWearableIntoDailyEntry(
  args: WearableMergeArgs,
): WearableMergeResult {
  const { daily, wearable_observations } = args;
  const patch: Partial<DailyEntry> = {};
  const manual_kept: Array<NumericDailyField> = [];

  // Group wearables by target field, picking the most-recent per field.
  const byField = new Map<NumericDailyField, WearableObservation>();
  for (const obs of wearable_observations) {
    const field = DAILY_FIELD_MAP[obs.metric_id];
    if (!field) continue;
    const existing = byField.get(field);
    if (!existing || obs.recorded_at > existing.recorded_at) {
      byField.set(field, obs);
    }
  }

  for (const [field, obs] of byField) {
    const dailyValue = daily?.[field];
    if (dailyValue == null) {
      patch[field] = obs.value;
      continue;
    }
    // Field already populated. Compare timestamps.
    const enteredAt = daily?.entered_at;
    if (enteredAt && enteredAt > obs.recorded_at) {
      manual_kept.push(field);
      continue;
    }
    patch[field] = obs.value;
  }

  return { patch, manual_kept };
}
