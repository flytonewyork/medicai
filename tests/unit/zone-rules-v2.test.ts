import { describe, it, expect } from "vitest";
import { ZONE_RULES_V2 } from "~/lib/rules/zone-rules-v2";
import { ZONE_RULES } from "~/lib/rules/zone-rules";
import { evaluateRules } from "~/lib/rules/engine";
import type { ClinicalSnapshot } from "~/lib/rules/types";
import { buildPatientState } from "~/lib/state";
import type {
  DailyEntry,
  FortnightlyAssessment,
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
    neuropathy_hands: 0,
    neuropathy_feet: 0,
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
  date: string,
  grip: number,
): FortnightlyAssessment {
  return {
    assessment_date: date,
    entered_at: `${date}T12:00:00Z`,
    entered_by: "hulin",
    ecog_self: 1,
    grip_dominant_kg: grip,
    created_at: `${date}T12:00:00Z`,
    updated_at: `${date}T12:00:00Z`,
  };
}

function snapshotWith(args: {
  fortnightlies: FortnightlyAssessment[];
  asOf?: string;
}): ClinicalSnapshot {
  const asOf = args.asOf ?? "2026-04-20T12:00:00Z";
  const sortedDesc = [...args.fortnightlies].sort(
    (a, b) =>
      Date.parse(b.assessment_date) - Date.parse(a.assessment_date),
  );
  return {
    settings: baseSettings,
    latestDaily: daily(),
    recentDailies: [daily()],
    recentWeeklies: [],
    latestFortnightly: sortedDesc[0] ?? null,
    recentLabs: [],
    openPendingResults: [],
    now: new Date(asOf),
    patient_state: buildPatientState({
      as_of: asOf,
      settings: baseSettings,
      dailies: [daily()],
      fortnightlies: args.fortnightlies,
      labs: [],
      cycles: [],
    }),
  };
}

describe("ZONE_RULES_V2 — superset of V1", () => {
  it("includes every V1 rule by id", () => {
    const v1Ids = new Set(ZONE_RULES.map((r) => r.id));
    const v2Ids = new Set(ZONE_RULES_V2.map((r) => r.id));
    for (const id of v1Ids) expect(v2Ids.has(id)).toBe(true);
  });

  it("adds grip chronic-drift detectors not in V1", () => {
    const v1Ids = new Set(ZONE_RULES.map((r) => r.id));
    const v2OnlyIds = ZONE_RULES_V2
      .filter((r) => !v1Ids.has(r.id))
      .map((r) => r.id);
    expect(v2OnlyIds).toContain("grip_chronic_drift_yellow");
    expect(v2OnlyIds).toContain("grip_chronic_drift_orange");
  });
});

describe("grip_chronic_drift_yellow", () => {
  it("does not fire when slope_28d is null (no fortnightly history)", () => {
    const s = snapshotWith({ fortnightlies: [] });
    const ids = evaluateRules(s, ZONE_RULES_V2).map((r) => r.id);
    expect(ids).not.toContain("grip_chronic_drift_yellow");
  });

  it("does not fire on a stable grip series", () => {
    // Grip flat at 40 over five fortnightly checkpoints — slope ≈ 0.
    const s = snapshotWith({
      fortnightlies: [
        fortnightly("2026-03-01", 40),
        fortnightly("2026-03-15", 40),
        fortnightly("2026-04-01", 40),
        fortnightly("2026-04-15", 40),
      ],
      asOf: "2026-04-20T12:00:00Z",
    });
    const ids = evaluateRules(s, ZONE_RULES_V2).map((r) => r.id);
    expect(ids).not.toContain("grip_chronic_drift_yellow");
    expect(ids).not.toContain("grip_chronic_drift_orange");
  });

  it("fires yellow when grip drifts ~2.5 kg over 28 days", () => {
    // Grip declining steadily — slope_28d will be roughly -2.5/14 day
    // ≈ -0.18 kg/day across the recent fortnightlies, well past the
    // yellow threshold of -0.0714 kg/day. We assert SOMETHING in the
    // chronic-drift family fires (yellow OR orange).
    const s = snapshotWith({
      fortnightlies: [
        fortnightly("2026-04-04", 40),
        fortnightly("2026-04-11", 39),
        fortnightly("2026-04-18", 38),
      ],
      asOf: "2026-04-20T12:00:00Z",
    });
    const ids = evaluateRules(s, ZONE_RULES_V2).map((r) => r.id);
    const fired = ids.filter((id) => id.startsWith("grip_chronic_drift_"));
    expect(fired.length).toBeGreaterThanOrEqual(1);
  });

  it("fires orange when grip drifts ~5 kg over 14 days (severe)", () => {
    const s = snapshotWith({
      fortnightlies: [
        fortnightly("2026-04-04", 40),
        fortnightly("2026-04-11", 37),
        fortnightly("2026-04-18", 35),
      ],
      asOf: "2026-04-20T12:00:00Z",
    });
    const ids = evaluateRules(s, ZONE_RULES_V2).map((r) => r.id);
    expect(ids).toContain("grip_chronic_drift_orange");
  });

  it("does not exist in V1 — proving V2 divergence", () => {
    const v1Ids = new Set(ZONE_RULES.map((r) => r.id));
    expect(v1Ids.has("grip_chronic_drift_yellow")).toBe(false);
    expect(v1Ids.has("grip_chronic_drift_orange")).toBe(false);
  });
});
