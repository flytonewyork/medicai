// Wearable types — the contract between Health Connect (or any other
// passive-collection source) and the analytical layer.
//
// One row per (date, metric_id, source_device) into Dexie's
// `wearable_observations` table. The integration layer reads from
// the device, normalises to this shape, and writes; downstream
// consumers (DailyEntry merge, state/metrics, analytical layer) read
// from Dexie without caring which device produced the value.
//
// Health Connect on Android is the primary integration target;
// equivalent shapes from Google Fit / vendor SDKs map onto the same
// row.

export type WearableMetricKind =
  // Cardiovascular / autonomic
  | "resting_hr_bpm"
  | "hrv_rmssd_ms"
  | "spo2_pct_overnight"
  // Activity
  | "steps"
  | "active_calories_kcal"
  // Sleep
  | "sleep_total_minutes"
  | "sleep_efficiency_pct"
  | "sleep_waso_min"          // wake after sleep onset
  | "sleep_awakenings_count"
  // Body composition
  | "weight_kg"
  | "body_fat_pct"
  | "body_temperature_c";     // skin / wrist; not core

// Where the row originated. Free-form so future devices don't require
// a code change to record provenance, but keep the canonical values
// stable so the precedence resolver can match.
export type WearableSource =
  | "oura"                    // Oura ring (preferred)
  | "samsung_health"
  | "garmin"
  | "fitbit"
  | "withings"                // smart scale
  | "google_fit"              // step / weight from phone
  | "health_connect"          // generic — when source app isn't tagged
  | "manual"                  // user override
  | "test";

export interface WearableObservation {
  // String PK; deterministic so the same Health Connect record
  // imported twice doesn't duplicate. Pattern:
  //   `${source}:${metric_id}:${date}` for daily aggregates
  // Sub-day signals (live HR) aren't wearable_observations — those
  // live in a separate stream not part of the v1 design.
  id: string;
  date: string;                              // ISO YYYY-MM-DD
  metric_id: WearableMetricKind;
  value: number;
  unit?: string;                             // for audit / debug
  source_device: WearableSource;
  // Some Health Connect signals attach a confidence / quality tag
  // (e.g. sleep stages). Optional; consumers ignore when absent.
  confidence?: "low" | "medium" | "high";
  // ISO datetime when the observation was first recorded by the
  // source device. For sleep this is wake time; for daily aggregates
  // this is end-of-day. Distinct from `created_at` (when our app
  // wrote it to Dexie).
  recorded_at: string;
  created_at: string;
  // True when the patient or Thomas manually overrode the wearable
  // value (e.g. the ring miscounted overnight). Once true, the sync
  // engine does not overwrite it on subsequent pulls.
  manual_override?: boolean;
}

// What the integration layer asks the platform for on each pull.
// One day = one tick across all enabled metrics.
export interface WearableSyncWindow {
  start_date: string;                        // ISO date
  end_date: string;                          // ISO date, inclusive
  metrics: ReadonlyArray<WearableMetricKind>;
}

// Result of a single sync tick. `inserted` and `updated` are
// Dexie ids; `skipped_manual` carries ids whose `manual_override`
// blocked the wearable value from being applied.
export interface WearableSyncResult {
  inserted: string[];
  updated: string[];
  skipped_manual: string[];
  error?: string;
}
