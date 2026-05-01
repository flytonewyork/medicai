import { describe, it, expect } from "vitest";
import { mergeWearableIntoDailyEntry } from "~/lib/wearable";
import type { DailyEntry } from "~/types/clinical";
import type { WearableObservation } from "~/types/wearable";

function dailyEntry(overrides: Partial<DailyEntry>): DailyEntry {
  return {
    date: "2026-04-12",
    entered_at: "2026-04-12T08:00:00.000Z",
    entered_by: "thomas",
    created_at: "2026-04-12T08:00:00.000Z",
    updated_at: "2026-04-12T08:00:00.000Z",
    ...overrides,
  };
}

function wearable(overrides: Partial<WearableObservation>): WearableObservation {
  return {
    id: "oura:steps:2026-04-12",
    date: "2026-04-12",
    metric_id: "steps",
    value: 4200,
    source_device: "oura",
    recorded_at: "2026-04-12T23:00:00.000Z",
    created_at: "2026-04-13T01:00:00.000Z",
    ...overrides,
  };
}

describe("wearable / mergeWearableIntoDailyEntry", () => {
  it("fills steps when the daily entry has no value", () => {
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({}),
      wearable_observations: [wearable({})],
    });
    expect(result.patch.steps).toBe(4200);
    expect(result.manual_kept).toEqual([]);
  });

  it("fills weight when the daily entry has no value", () => {
    const obs = wearable({
      id: "withings:weight_kg:2026-04-12",
      metric_id: "weight_kg",
      value: 71.4,
      source_device: "withings",
    });
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({}),
      wearable_observations: [obs],
    });
    expect(result.patch.weight_kg).toBe(71.4);
  });

  it("keeps the manual value when the daily entry was entered after the wearable", () => {
    const obs = wearable({ recorded_at: "2026-04-12T07:00:00.000Z" });
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({
        steps: 3500,
        entered_at: "2026-04-12T20:00:00.000Z",
      }),
      wearable_observations: [obs],
    });
    expect(result.patch.steps).toBeUndefined();
    expect(result.manual_kept).toContain("steps");
  });

  it("overwrites the manual value when the wearable was recorded later", () => {
    const obs = wearable({ recorded_at: "2026-04-12T22:00:00.000Z" });
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({
        steps: 3500,
        entered_at: "2026-04-12T08:00:00.000Z",
      }),
      wearable_observations: [obs],
    });
    expect(result.patch.steps).toBe(4200);
    expect(result.manual_kept).toEqual([]);
  });

  it("ignores wearable metrics that have no DailyEntry field", () => {
    const obs = wearable({
      id: "oura:hrv_rmssd_ms:2026-04-12",
      metric_id: "hrv_rmssd_ms",
      value: 38,
    });
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({}),
      wearable_observations: [obs],
    });
    expect(result.patch).toEqual({});
    expect(result.manual_kept).toEqual([]);
  });

  it("picks the most-recent observation when multiple sources cover the same field", () => {
    const oura = wearable({
      id: "oura:steps:2026-04-12",
      source_device: "oura",
      value: 4200,
      recorded_at: "2026-04-12T22:00:00.000Z",
    });
    const phone = wearable({
      id: "google_fit:steps:2026-04-12",
      source_device: "google_fit",
      value: 4500,
      recorded_at: "2026-04-12T23:30:00.000Z",
    });
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: dailyEntry({}),
      wearable_observations: [oura, phone],
    });
    // Phone recorded later — wins.
    expect(result.patch.steps).toBe(4500);
  });

  it("returns an empty patch when daily is null and no wearable maps", () => {
    const result = mergeWearableIntoDailyEntry({
      date: "2026-04-12",
      daily: null,
      wearable_observations: [
        wearable({ metric_id: "hrv_rmssd_ms", value: 38 }),
      ],
    });
    expect(result.patch).toEqual({});
  });
});
