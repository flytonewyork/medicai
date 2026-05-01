import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  MockHealthConnectClient,
  syncWearableObservations,
  wearableObservationId,
} from "~/lib/wearable";
import type { WearableObservation } from "~/types/wearable";

const NOW = "2026-04-12T08:00:00.000Z";
const nowFn = () => NOW;

function obs(overrides: Partial<WearableObservation>): WearableObservation {
  return {
    id: wearableObservationId({
      source_device: "oura",
      metric_id: "resting_hr_bpm",
      date: "2026-04-12",
    }),
    date: "2026-04-12",
    metric_id: "resting_hr_bpm",
    value: 64,
    unit: "bpm",
    source_device: "oura",
    recorded_at: "2026-04-12T07:30:00.000Z",
    created_at: NOW,
    ...overrides,
  };
}

describe("wearable / syncWearableObservations", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("inserts new observations from the client", async () => {
    const seed = obs({});
    const client = new MockHealthConnectClient({
      permissions: { resting_hr_bpm: "granted" },
      observations: [seed],
    });
    const result = await syncWearableObservations(
      {
        start_date: "2026-04-12",
        end_date: "2026-04-12",
        metrics: ["resting_hr_bpm"],
      },
      { client, table: db.wearable_observations, now: nowFn },
    );
    expect(result.inserted).toEqual([seed.id]);
    expect(result.updated).toEqual([]);
    expect(result.skipped_manual).toEqual([]);
    const stored = await db.wearable_observations.get(seed.id);
    expect(stored?.value).toBe(64);
  });

  it("updates an existing observation when re-imported with a new value", async () => {
    const initial = obs({ value: 60 });
    await db.wearable_observations.put(initial);
    const updated = obs({ value: 68, recorded_at: "2026-04-12T22:00:00.000Z" });
    const client = new MockHealthConnectClient({
      permissions: { resting_hr_bpm: "granted" },
      observations: [updated],
    });
    const result = await syncWearableObservations(
      {
        start_date: "2026-04-12",
        end_date: "2026-04-12",
        metrics: ["resting_hr_bpm"],
      },
      { client, table: db.wearable_observations, now: nowFn },
    );
    expect(result.updated).toEqual([initial.id]);
    expect(result.inserted).toEqual([]);
    const stored = await db.wearable_observations.get(initial.id);
    expect(stored?.value).toBe(68);
  });

  it("skips updates when manual_override is true", async () => {
    const initial = obs({ value: 60, manual_override: true });
    await db.wearable_observations.put(initial);
    const incoming = obs({ value: 999 });
    const client = new MockHealthConnectClient({
      permissions: { resting_hr_bpm: "granted" },
      observations: [incoming],
    });
    const result = await syncWearableObservations(
      {
        start_date: "2026-04-12",
        end_date: "2026-04-12",
        metrics: ["resting_hr_bpm"],
      },
      { client, table: db.wearable_observations, now: nowFn },
    );
    expect(result.skipped_manual).toEqual([initial.id]);
    const stored = await db.wearable_observations.get(initial.id);
    expect(stored?.value).toBe(60);
  });

  it("returns empty when no permissions are granted", async () => {
    const client = new MockHealthConnectClient({
      permissions: { resting_hr_bpm: "denied" },
      observations: [obs({})],
    });
    const result = await syncWearableObservations(
      {
        start_date: "2026-04-12",
        end_date: "2026-04-12",
        metrics: ["resting_hr_bpm"],
      },
      { client, table: db.wearable_observations, now: nowFn },
    );
    expect(result.inserted).toEqual([]);
    expect(result.updated).toEqual([]);
  });

  it("captures the client error string when readDaily throws", async () => {
    const client: any = {
      isAvailable: async () => true,
      permissionsFor: async () => ({}),
      requestPermissions: async () => ({}),
      readDaily: async () => {
        throw new Error("HC not installed");
      },
    };
    const result = await syncWearableObservations(
      {
        start_date: "2026-04-12",
        end_date: "2026-04-12",
        metrics: ["resting_hr_bpm"],
      },
      { client, table: db.wearable_observations, now: nowFn },
    );
    expect(result.error).toBe("HC not installed");
    expect(result.inserted).toEqual([]);
  });
});

describe("wearable / wearableObservationId", () => {
  it("is deterministic across calls with the same args", () => {
    const a = wearableObservationId({
      source_device: "oura",
      metric_id: "resting_hr_bpm",
      date: "2026-04-12",
    });
    const b = wearableObservationId({
      source_device: "oura",
      metric_id: "resting_hr_bpm",
      date: "2026-04-12",
    });
    expect(a).toBe(b);
    expect(a).toBe("oura:resting_hr_bpm:2026-04-12");
  });

  it("differs when source_device differs", () => {
    expect(
      wearableObservationId({
        source_device: "oura",
        metric_id: "steps",
        date: "2026-04-12",
      }),
    ).not.toBe(
      wearableObservationId({
        source_device: "google_fit",
        metric_id: "steps",
        date: "2026-04-12",
      }),
    );
  });
});
