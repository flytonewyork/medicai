import { describe, it, expect } from "vitest";
import { computeTrendNudges } from "~/lib/nudges/trend-nudges";
import type { DailyEntry, LabResult, Settings } from "~/types/clinical";

function d(overrides: Partial<DailyEntry>): DailyEntry {
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
  baseline_weight_kg: 80,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("computeTrendNudges", () => {
  it("surfaces a check-in reminder when today is not logged", () => {
    const nudges = computeTrendNudges({
      settings,
      recentDailies: [],
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "checkin_today")).toBeTruthy();
  });

  it("no check-in reminder when today is already logged", () => {
    const nudges = computeTrendNudges({
      settings,
      recentDailies: [d({ date: "2026-04-21" })],
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "checkin_today")).toBeUndefined();
  });

  it("encouragement when weight stable near baseline", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({
        date: `2026-04-${14 + i}`,
        weight_kg: 80 + (i % 2 === 0 ? 0.3 : -0.2),
      }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_weight_stable")).toBeTruthy();
  });

  it("caution when weight drifting 3-5% below baseline", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}`, weight_kg: 77 }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_weight_drifting")).toBeTruthy();
  });

  it("flags low protein adherence", () => {
    // Baseline weight 80 kg → target 96 g/day. Low threshold = 72 g/day.
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}`, protein_grams: 40 }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_protein_low")).toBeTruthy();
  });

  it("encouragement when protein on target", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}`, protein_grams: 105 }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(
      nudges.find((n) => n.id === "trend_protein_on_target"),
    ).toBeTruthy();
  });

  it("encouragement on 5+ walking days", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}`, walking_minutes: 20 }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_walking_consistent")).toBeTruthy();
  });

  it("nudges resistance when absent all week", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}`, resistance_training: false }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_resistance_absent")).toBeTruthy();
  });

  it("positive CA 19-9 trend when falling ≥ 20%", () => {
    const labs: LabResult[] = [
      {
        date: "2026-02-01",
        ca199: 300,
        source: "epworth",
        created_at: "2026-02-01",
        updated_at: "2026-02-01",
      },
      {
        date: "2026-03-01",
        ca199: 240,
        source: "epworth",
        created_at: "2026-03-01",
        updated_at: "2026-03-01",
      },
      {
        date: "2026-04-01",
        ca199: 180,
        source: "epworth",
        created_at: "2026-04-01",
        updated_at: "2026-04-01",
      },
    ];
    const nudges = computeTrendNudges({
      settings,
      recentDailies: [],
      recentLabs: labs,
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_ca199_falling")).toBeTruthy();
  });

  it("caution when CA 19-9 rises ≥ 15%", () => {
    const labs: LabResult[] = [
      {
        date: "2026-02-01",
        ca199: 100,
        source: "epworth",
        created_at: "2026-02-01",
        updated_at: "2026-02-01",
      },
      {
        date: "2026-03-01",
        ca199: 120,
        source: "epworth",
        created_at: "2026-03-01",
        updated_at: "2026-03-01",
      },
      {
        date: "2026-04-01",
        ca199: 140,
        source: "epworth",
        created_at: "2026-04-01",
        updated_at: "2026-04-01",
      },
    ];
    const nudges = computeTrendNudges({
      settings,
      recentDailies: [],
      recentLabs: labs,
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_ca199_rising")).toBeTruthy();
  });

  it("streak nudge on 7 days logged", () => {
    const dailies: DailyEntry[] = Array.from({ length: 7 }, (_, i) =>
      d({ date: `2026-04-${14 + i}` }),
    );
    const nudges = computeTrendNudges({
      settings,
      recentDailies: dailies,
      recentLabs: [],
      todayISO: "2026-04-21",
    });
    expect(nudges.find((n) => n.id === "trend_streak_7")).toBeTruthy();
  });
});
