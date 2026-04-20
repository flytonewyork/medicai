import { describe, it, expect } from "vitest";
import { ZONE_RULES } from "~/lib/rules/zone-rules";
import { evaluateRules, highestZone } from "~/lib/rules/engine";
import type { ClinicalSnapshot } from "~/lib/rules/types";
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  Settings,
} from "~/types/clinical";

const baseSettings: Settings = {
  id: 1,
  profile_name: "Test",
  locale: "en",
  baseline_weight_kg: 80,
  baseline_grip_dominant_kg: 40,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function daily(overrides: Partial<DailyEntry> = {}): DailyEntry {
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
    weight_kg: 80,
    practice_morning_completed: true,
    practice_evening_completed: true,
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

function fortnightly(
  overrides: Partial<FortnightlyAssessment> = {},
): FortnightlyAssessment {
  return {
    assessment_date: "2026-04-18",
    entered_at: "2026-04-18T12:00:00Z",
    entered_by: "hulin",
    ecog_self: 1,
    created_at: "2026-04-18T12:00:00Z",
    updated_at: "2026-04-18T12:00:00Z",
    ...overrides,
  };
}

function snapshot(over: Partial<ClinicalSnapshot> = {}): ClinicalSnapshot {
  return {
    settings: baseSettings,
    latestDaily: daily(),
    recentDailies: [daily()],
    recentWeeklies: [],
    latestFortnightly: null,
    recentLabs: [],
    now: new Date("2026-04-20"),
    ...over,
  };
}

describe("zone engine", () => {
  it("no rules trigger on stable baseline data", () => {
    expect(evaluateRules(snapshot())).toEqual([]);
  });

  it("triggers weight loss yellow at 6%", () => {
    const triggered = evaluateRules(
      snapshot({ latestDaily: daily({ weight_kg: 75.2 }) }),
    );
    expect(triggered.map((r) => r.id)).toContain("weight_loss_5_10_yellow");
  });

  it("triggers weight loss orange at 12%", () => {
    const triggered = evaluateRules(
      snapshot({ latestDaily: daily({ weight_kg: 70 }) }),
    );
    expect(triggered.map((r) => r.id)).toContain("weight_loss_10_plus_orange");
  });

  it("triggers fever → red", () => {
    const triggered = evaluateRules(
      snapshot({ latestDaily: daily({ fever: true, fever_temp: 38.5 }) }),
    );
    expect(triggered.map((r) => r.id)).toContain("febrile_neutropenia_red");
  });

  it("triggers grip decline yellow at 15%", () => {
    const triggered = evaluateRules(
      snapshot({
        latestFortnightly: fortnightly({ grip_dominant_kg: 34 }),
      }),
    );
    expect(triggered.map((r) => r.id)).toContain("grip_decline_10_20_yellow");
  });

  it("triggers neuropathy orange at grade 3", () => {
    const triggered = evaluateRules(
      snapshot({
        latestFortnightly: fortnightly({ neuropathy_grade: 3 }),
      }),
    );
    expect(triggered.map((r) => r.id)).toContain("neuropathy_grade_3_orange");
  });

  it("detects 3-consecutive CA19-9 rise", () => {
    const mkLab = (d: string, ca199: number): LabResult => ({
      date: d,
      ca199,
      source: "epworth",
      created_at: d,
      updated_at: d,
    });
    const triggered = evaluateRules(
      snapshot({
        recentLabs: [
          mkLab("2026-03-01", 100),
          mkLab("2026-03-20", 150),
          mkLab("2026-04-10", 220),
        ],
      }),
    );
    expect(triggered.map((r) => r.id)).toContain(
      "ca199_rising_3_consecutive_yellow",
    );
  });

  it("PHQ-9 ≥15 yields orange, not yellow", () => {
    const triggered = evaluateRules(
      snapshot({
        latestFortnightly: fortnightly({ phq9_total: 17 }),
      }),
    );
    const ids = triggered.map((r) => r.id);
    expect(ids).toContain("phq9_severe_orange");
    expect(ids).not.toContain("phq9_moderate_yellow");
  });
});

describe("highestZone", () => {
  it("picks red over others", () => {
    expect(highestZone(["green", "yellow", "red", "orange"])).toBe("red");
  });
  it("falls back to green when empty", () => {
    expect(highestZone([])).toBe("green");
  });
});

describe("rule catalogue sanity", () => {
  it("every rule has unique id", () => {
    const ids = ZONE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every rule has a zone and category", () => {
    for (const r of ZONE_RULES) {
      expect(["yellow", "orange", "red"]).toContain(r.zone);
      expect(r.category).toBeTruthy();
    }
  });
});
