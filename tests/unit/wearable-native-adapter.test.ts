// Tests for the pure helpers inside NativeHealthConnectClient. The
// end-to-end Capacitor + Health Connect flow has to be validated on
// a real Android device with the Oura ring publishing data; these
// tests cover the deterministic transformation layer so a refactor
// of the adapter doesn't silently corrupt the data shape going into
// Dexie.
import { describe, it, expect, vi } from "vitest";

// The capacitor-health-connect plugin pulls in native bindings that
// aren't available under jsdom. Mock at the module level so the
// adapter's import resolves.
vi.mock("capacitor-health-connect", () => ({
  HealthConnect: {
    checkAvailability: vi.fn(),
    checkHealthPermissions: vi.fn(),
    requestHealthPermissions: vi.fn(),
    readRecords: vi.fn(),
  },
}));

import { _internals } from "~/lib/wearable/native-client";

describe("native adapter / extractValue", () => {
  it("reads `count` for Steps records", () => {
    expect(_internals.extractValue({ count: 4250 })).toBe(4250);
  });

  it("reads `beatsPerMinute` for resting heart rate", () => {
    expect(_internals.extractValue({ beatsPerMinute: 62 })).toBe(62);
  });

  it("reads `percentage` for body fat / SpO2", () => {
    expect(_internals.extractValue({ percentage: 23.5 })).toBe(23.5);
  });

  it("reads weight `value` from the nested mass object", () => {
    expect(
      _internals.extractValue({ weight: { value: 71.2, unit: "kilograms" } }),
    ).toBe(71.2);
  });

  it("reads temperature `value` from the nested temperature object", () => {
    expect(
      _internals.extractValue({ temperature: { value: 36.8, unit: "celsius" } }),
    ).toBe(36.8);
  });

  it("reads energy `value` for active calories", () => {
    expect(
      _internals.extractValue({ energy: { value: 320, unit: "kilocalories" } }),
    ).toBe(320);
  });

  it("returns null on an unknown shape", () => {
    expect(_internals.extractValue({ random: "thing" })).toBeNull();
    expect(_internals.extractValue(null)).toBeNull();
    expect(_internals.extractValue(undefined)).toBeNull();
  });
});

describe("native adapter / extractStartIso", () => {
  it("prefers startTime for series records", () => {
    expect(
      _internals.extractStartIso({
        startTime: "2026-04-12T07:30:00Z",
        endTime: "2026-04-12T15:00:00Z",
      }),
    ).toBe("2026-04-12T07:30:00Z");
  });

  it("falls back to time for instantaneous records", () => {
    expect(_internals.extractStartIso({ time: "2026-04-12T08:00:00Z" })).toBe(
      "2026-04-12T08:00:00Z",
    );
  });

  it("returns null when neither field is present", () => {
    expect(_internals.extractStartIso({})).toBeNull();
  });
});

describe("native adapter / originToSource", () => {
  it("maps known package names to canonical sources", () => {
    expect(_internals.originToSource("com.ouraring.oura")).toBe("oura");
    expect(_internals.originToSource("com.garmin.android.apps.connectmobile")).toBe("garmin");
    expect(_internals.originToSource("com.samsung.android.shealth")).toBe("samsung_health");
    expect(_internals.originToSource("com.withings.wiscale2")).toBe("withings");
    expect(_internals.originToSource("com.fitbit.FitbitMobile")).toBe("fitbit");
    expect(_internals.originToSource("com.google.android.apps.fitness")).toBe(
      "google_fit",
    );
  });

  it("falls back to 'health_connect' on null or unknown origins", () => {
    expect(_internals.originToSource(null)).toBe("health_connect");
    expect(_internals.originToSource("com.unknown.app")).toBe("health_connect");
  });
});

describe("native adapter / extractDataOrigin", () => {
  it("returns the dataOrigin from record metadata", () => {
    expect(
      _internals.extractDataOrigin({
        metadata: { dataOrigin: "com.ouraring.oura" },
      }),
    ).toBe("com.ouraring.oura");
  });

  it("returns null when metadata is missing", () => {
    expect(_internals.extractDataOrigin({})).toBeNull();
    expect(_internals.extractDataOrigin(null)).toBeNull();
  });
});

describe("native adapter / METRIC_TO_RECORD coverage", () => {
  it("maps every plugin-supported WearableMetricKind", () => {
    const map = _internals.METRIC_TO_RECORD;
    expect(map.resting_hr_bpm).toBe("RestingHeartRate");
    expect(map.spo2_pct_overnight).toBe("OxygenSaturation");
    expect(map.steps).toBe("Steps");
    expect(map.weight_kg).toBe("Weight");
    expect(map.body_fat_pct).toBe("BodyFat");
    expect(map.body_temperature_c).toBe("BodyTemperature");
    expect(map.active_calories_kcal).toBe("ActiveCaloriesBurned");
  });

  it("does NOT map HRV / Sleep until plugin support arrives", () => {
    const map = _internals.METRIC_TO_RECORD;
    expect(map.hrv_rmssd_ms).toBeUndefined();
    expect(map.sleep_total_minutes).toBeUndefined();
    expect(map.sleep_efficiency_pct).toBeUndefined();
  });
});

describe("native adapter / AGGREGATION_FOR_RECORD", () => {
  it("uses sum for cumulative metrics", () => {
    expect(_internals.AGGREGATION_FOR_RECORD.Steps).toBe("sum");
    expect(_internals.AGGREGATION_FOR_RECORD.ActiveCaloriesBurned).toBe("sum");
  });

  it("uses mean for instantaneous physiological metrics", () => {
    expect(_internals.AGGREGATION_FOR_RECORD.RestingHeartRate).toBe("mean");
    expect(_internals.AGGREGATION_FOR_RECORD.OxygenSaturation).toBe("mean");
  });

  it("uses latest for state-like metrics", () => {
    expect(_internals.AGGREGATION_FOR_RECORD.Weight).toBe("latest");
    expect(_internals.AGGREGATION_FOR_RECORD.BodyFat).toBe("latest");
    expect(_internals.AGGREGATION_FOR_RECORD.BodyTemperature).toBe("latest");
  });
});
