import { describe, it, expect } from "vitest";
import { __test__ } from "~/hooks/use-metrics";
import type { DailyEntry, Settings } from "~/types/clinical";

const { computeMetrics } = __test__;

function daily(overrides: Partial<DailyEntry>): DailyEntry {
  return {
    date: "2026-04-20",
    entered_at: "2026-04-20T09:00:00Z",
    entered_by: "hulin",
    energy: 5,
    sleep_quality: 5,
    appetite: 5,
    pain_worst: 0,
    pain_current: 0,
    mood_clarity: 5,
    nausea: 0,
    practice_morning_completed: false,
    practice_evening_completed: false,
    cold_dysaesthesia: false,
    neuropathy_hands: false,
    neuropathy_feet: false,
    mouth_sores: false,
    diarrhoea_count: 0,
    new_bruising: false,
    dyspnoea: false,
    fever: false,
    created_at: "2026-04-20T09:00:00Z",
    updated_at: "2026-04-20T09:00:00Z",
    ...overrides,
  };
}

const settings: Settings = {
  id: 1,
  profile_name: "Test",
  locale: "en",
  height_cm: 175,
  baseline_weight_kg: 80,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("computeMetrics", () => {
  it("returns none direction with no weight data", () => {
    const m = computeMetrics([], undefined);
    expect(m.weightDirection).toBe("none");
    expect(m.latestWeight).toBeUndefined();
  });

  it("computes weight change vs baseline", () => {
    const entries = [
      daily({ date: "2026-04-18", weight_kg: 80 }),
      daily({ date: "2026-04-19", weight_kg: 78 }),
      daily({ date: "2026-04-20", weight_kg: 76 }),
    ];
    // entries come in as ordered desc reversed in hook; for test, pass as arrives from desc query
    const m = computeMetrics(entries.slice().reverse(), settings);
    expect(m.latestWeight).toBe(76);
    expect(m.weightChangePct).toBeCloseTo(-5, 1);
    expect(m.weightDirection).toBe("down");
  });

  it("computes BMI when height present", () => {
    const m = computeMetrics(
      [daily({ weight_kg: 70 })],
      { ...settings, height_cm: 175 },
    );
    expect(m.bmi).toBeCloseTo(70 / 1.75 / 1.75, 2);
    expect(m.bmiLabel).toBe("Healthy");
  });

  it("averages protein over last 7 days", () => {
    const entries = [
      daily({ date: "2026-04-14", protein_grams: 60 }),
      daily({ date: "2026-04-15", protein_grams: 80 }),
      daily({ date: "2026-04-16", protein_grams: 100 }),
    ];
    const m = computeMetrics(entries.slice().reverse(), settings);
    expect(m.proteinAvg7d).toBeCloseTo(80, 1);
  });

  it("sums weekly exercise and counts resistance days", () => {
    const entries = [
      daily({
        date: "2026-04-18",
        walking_minutes: 30,
        other_exercise_minutes: 15,
        resistance_training: true,
      }),
      daily({
        date: "2026-04-19",
        walking_minutes: 20,
        resistance_training: true,
      }),
      daily({ date: "2026-04-20", walking_minutes: 40 }),
    ];
    const m = computeMetrics(entries.slice().reverse(), settings);
    expect(m.exerciseMinutes7d).toBe(30 + 15 + 20 + 40);
    expect(m.resistanceDays7d).toBe(2);
    expect(m.walkingMinutes7d).toBe(90);
  });

  it("computes practice completion percentage", () => {
    const entries = [
      daily({
        date: "2026-04-19",
        practice_morning_completed: true,
        practice_evening_completed: true,
      }),
      daily({
        date: "2026-04-20",
        practice_morning_completed: true,
        practice_evening_completed: false,
      }),
    ];
    const m = computeMetrics(entries.slice().reverse(), settings);
    // 3 of 4 possible sessions
    expect(m.practicePct28d).toBeCloseTo(75, 1);
  });
});
