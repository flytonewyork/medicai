// NativeHealthConnectClient — implements the HealthConnectClient
// contract by adapting the `capacitor-health-connect` plugin's API.
//
// The plugin (v0.7.0) exposes a record-type-keyed surface; this
// adapter translates between our WearableMetricKind taxonomy and the
// plugin's RecordType strings, aggregates intra-day records into
// daily values where the analytical layer expects daily aggregates
// (sum for steps, mean for RHR / SpO2, latest for weight / body fat
// / body temp), and writes WearableObservation rows.
//
// Coverage in v0.7.0:
//   - resting_hr_bpm        ✓ (RestingHeartRate)
//   - spo2_pct_overnight    ✓ (OxygenSaturation; daily mean)
//   - steps                 ✓ (Steps; daily sum)
//   - weight_kg             ✓ (Weight; daily latest)
//   - body_fat_pct          ✓ (BodyFat; daily latest)
//   - body_temperature_c    ✓ (BodyTemperature; daily latest)
//   - active_calories_kcal  ✓ (ActiveCaloriesBurned; daily sum)
//
// Not yet supported by the plugin (deferred to a plugin extension PR):
//   - hrv_rmssd_ms          (HeartRateVariabilityRmssd record type)
//   - sleep_total_minutes   (SleepSession record type)
//   - sleep_efficiency_pct
//   - sleep_waso_min
//   - sleep_awakenings_count
//
// Pure adapter: no Dexie writes, no app state. The sync layer in
// `sync.ts` consumes the WearableObservation[] this returns.
import { HealthConnect } from "capacitor-health-connect";
import type {
  WearableMetricKind,
  WearableObservation,
  WearableSource,
  WearableSyncWindow,
} from "~/types/wearable";
import { wearableObservationId } from "./sync";
import type { HealthConnectClient, PermissionStatus } from "./types";

// Plugin RecordType strings — exact match to what the plugin's
// Serializer.kt accepts. Keep this list aligned with the plugin's
// public type union.
type RecordType =
  | "ActiveCaloriesBurned"
  | "BodyFat"
  | "BodyTemperature"
  | "OxygenSaturation"
  | "RestingHeartRate"
  | "Steps"
  | "Weight";

const METRIC_TO_RECORD: Partial<Record<WearableMetricKind, RecordType>> = {
  resting_hr_bpm: "RestingHeartRate",
  spo2_pct_overnight: "OxygenSaturation",
  steps: "Steps",
  weight_kg: "Weight",
  body_fat_pct: "BodyFat",
  body_temperature_c: "BodyTemperature",
  active_calories_kcal: "ActiveCaloriesBurned",
};

// How to collapse intra-day records into the daily aggregate the
// analytical layer expects.
type AggregationKind = "sum" | "mean" | "latest";
const AGGREGATION_FOR_RECORD: Record<RecordType, AggregationKind> = {
  Steps: "sum",
  ActiveCaloriesBurned: "sum",
  RestingHeartRate: "mean",
  OxygenSaturation: "mean",
  Weight: "latest",
  BodyFat: "latest",
  BodyTemperature: "latest",
};

// Field paths inside each plugin record where the numeric value lives.
// The plugin returns records as `{ type, count? | beatsPerMinute? |
// percentage? | weight: { value, unit } | ... }` — different shape per
// record type. We extract the relevant scalar.
function extractValue(record: unknown): number | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  if (typeof r.count === "number") return r.count;
  if (typeof r.beatsPerMinute === "number") return r.beatsPerMinute;
  if (typeof r.percentage === "number") return r.percentage;
  if (typeof r.energy === "object" && r.energy) {
    const e = r.energy as Record<string, unknown>;
    if (typeof e.value === "number") return e.value;
  }
  if (typeof r.weight === "object" && r.weight) {
    const w = r.weight as Record<string, unknown>;
    if (typeof w.value === "number") return w.value;
  }
  if (typeof r.temperature === "object" && r.temperature) {
    const t = r.temperature as Record<string, unknown>;
    if (typeof t.value === "number") return t.value;
  }
  return null;
}

function extractStartIso(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  // Health Connect series records have startTime; instantaneous have time.
  if (typeof r.startTime === "string") return r.startTime;
  if (typeof r.time === "string") return r.time;
  return null;
}

function extractDataOrigin(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const meta = r.metadata as Record<string, unknown> | undefined;
  if (!meta) return null;
  const origin = meta.dataOrigin;
  if (typeof origin === "string") return origin;
  return null;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function aggregate(
  values: number[],
  kind: AggregationKind,
): number | null {
  if (values.length === 0) return null;
  switch (kind) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "mean":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "latest":
      return values[values.length - 1] ?? null;
  }
}

// Map a Health Connect dataOrigin (Android package name) to our
// WearableSource taxonomy. Falls back to "health_connect" so a row
// always has a sensible source attribution.
function originToSource(origin: string | null): WearableSource {
  if (!origin) return "health_connect";
  if (origin.includes("oura")) return "oura";
  if (origin.includes("garmin")) return "garmin";
  if (origin.includes("samsung")) return "samsung_health";
  if (origin.includes("withings")) return "withings";
  if (origin.includes("fitbit")) return "fitbit";
  if (origin.includes("google")) return "google_fit";
  return "health_connect";
}

// Plugin uses uppercase strings for permission status that we
// normalise into our PermissionStatus union.
function normalisePermissionStatus(raw: unknown): PermissionStatus {
  if (raw === "granted") return "granted";
  if (raw === "denied") return "denied";
  return "not_requested";
}

export class NativeHealthConnectClient implements HealthConnectClient {
  async isAvailable(): Promise<boolean> {
    try {
      const result = await HealthConnect.checkAvailability();
      // Plugin returns { availability: 'Available' | 'NotInstalled' | ... }
      const avail = (result as { availability?: string })?.availability;
      return avail === "Available";
    } catch {
      return false;
    }
  }

  async permissionsFor(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>> {
    const supported = metrics
      .map((m) => ({ metric: m, record: METRIC_TO_RECORD[m] }))
      .filter((x): x is { metric: WearableMetricKind; record: RecordType } =>
        Boolean(x.record),
      );
    const result = {} as Record<WearableMetricKind, PermissionStatus>;
    for (const m of metrics) result[m] = "not_requested";
    if (supported.length === 0) return result;
    try {
      const response = await HealthConnect.checkHealthPermissions({
        read: supported.map((s) => s.record) as never,
        write: [],
      });
      const granted = (response as { read?: string[] })?.read ?? [];
      const grantedSet = new Set(granted);
      for (const { metric, record } of supported) {
        result[metric] = grantedSet.has(record) ? "granted" : "denied";
      }
    } catch {
      // On error, leave statuses as "not_requested" so the caller can
      // retry the request flow. Don't throw.
    }
    return result;
  }

  async requestPermissions(
    metrics: ReadonlyArray<WearableMetricKind>,
  ): Promise<Record<WearableMetricKind, PermissionStatus>> {
    const records: RecordType[] = [];
    for (const m of metrics) {
      const r = METRIC_TO_RECORD[m];
      if (r) records.push(r);
    }
    if (records.length === 0) {
      return this.permissionsFor(metrics);
    }
    try {
      await HealthConnect.requestHealthPermissions({
        read: records as never,
        write: [],
      });
    } catch {
      // Silently fall through to a follow-up status check; the user
      // may have cancelled the chooser.
    }
    return this.permissionsFor(metrics);
  }

  async readDaily(
    window: WearableSyncWindow,
  ): Promise<WearableObservation[]> {
    const observations: WearableObservation[] = [];
    const startIso = `${window.start_date}T00:00:00.000Z`;
    const endIso = `${window.end_date}T23:59:59.999Z`;
    const granted = await this.permissionsFor(window.metrics);

    for (const metric of window.metrics) {
      if (granted[metric] !== "granted") continue;
      const recordType = METRIC_TO_RECORD[metric];
      if (!recordType) continue;
      let response: unknown;
      try {
        response = await HealthConnect.readRecords({
          type: recordType as never,
          timeRangeFilter: {
            type: "between",
            startTime: startIso,
            endTime: endIso,
          } as never,
          ascendingOrder: true,
        });
      } catch {
        continue;
      }
      const records = (response as { records?: unknown[] })?.records ?? [];

      // Bucket by (date, source_device) for daily aggregation.
      const buckets = new Map<
        string,
        { values: number[]; lastIso: string; source: WearableSource }
      >();
      for (const rec of records) {
        const value = extractValue(rec);
        const ts = extractStartIso(rec);
        if (value == null || !ts) continue;
        const date = dateOnly(ts);
        const source = originToSource(extractDataOrigin(rec));
        const key = `${date}::${source}`;
        const bucket =
          buckets.get(key) ??
          { values: [], lastIso: ts, source };
        bucket.values.push(value);
        if (ts > bucket.lastIso) bucket.lastIso = ts;
        buckets.set(key, bucket);
      }

      const aggKind = AGGREGATION_FOR_RECORD[recordType];
      for (const [key, bucket] of buckets) {
        const [date] = key.split("::");
        if (!date) continue;
        const value = aggregate(bucket.values, aggKind);
        if (value == null) continue;
        observations.push({
          id: wearableObservationId({
            source_device: bucket.source,
            metric_id: metric,
            date,
          }),
          date,
          metric_id: metric,
          value,
          source_device: bucket.source,
          recorded_at: bucket.lastIso,
          created_at: new Date().toISOString(),
        });
      }
    }
    return observations;
  }
}

// Test seam: tests can shadow normalisePermissionStatus + extractValue
// without re-exporting the whole module surface.
export const _internals = {
  METRIC_TO_RECORD,
  AGGREGATION_FOR_RECORD,
  extractValue,
  extractStartIso,
  extractDataOrigin,
  originToSource,
  normalisePermissionStatus,
};
