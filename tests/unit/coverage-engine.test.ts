import { describe, it, expect } from "vitest";
import { computeCoverageGaps } from "~/lib/coverage/log-coverage";
import {
  classifyEngagement,
  coverageCapForState,
} from "~/lib/coverage/engagement-state";
import type {
  DailyEntry,
  Settings,
  ZoneAlert,
} from "~/types/clinical";
import type { CoverageSnoozeRow } from "~/types/coverage";

function entry(date: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date,
    entered_at: `${date}T07:00:00Z`,
    entered_by: "hulin",
    created_at: `${date}T07:00:00Z`,
    updated_at: `${date}T07:00:00Z`,
    ...overrides,
  };
}

function alert(zone: ZoneAlert["zone"]): ZoneAlert {
  return {
    rule_id: "x",
    rule_name: "x",
    zone,
    category: "toxicity",
    triggered_at: "2026-05-01T07:00:00Z",
    resolved: false,
    acknowledged: false,
    recommendation: "",
    recommendation_zh: "",
    suggested_levers: [],
    created_at: "2026-05-01T07:00:00Z",
    updated_at: "2026-05-01T07:00:00Z",
  };
}

describe("classifyEngagement", () => {
  it("returns rough when a red zone alert is active", () => {
    const state = classifyEngagement({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { stool_count: 2 })],
      activeAlerts: [alert("red")],
    });
    expect(state).toBe("rough");
  });

  it("returns rough on severe symptom signal in last 2 days", () => {
    const state = classifyEngagement({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-04-30", { fatigue: 8 })],
      activeAlerts: [],
    });
    expect(state).toBe("rough");
  });

  it("returns active when today has any signal", () => {
    const state = classifyEngagement({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { stool_count: 1 })],
      activeAlerts: [],
    });
    expect(state).toBe("active");
  });

  it("returns light with 2+ days logged in past 7 (excluding today)", () => {
    const state = classifyEngagement({
      todayISO: "2026-05-01",
      recentDailies: [
        entry("2026-04-29", { weight_kg: 65 }),
        entry("2026-04-28", { protein_grams: 60 }),
      ],
      activeAlerts: [],
    });
    expect(state).toBe("light");
  });

  it("returns quiet with no signal in last 7 days", () => {
    const state = classifyEngagement({
      todayISO: "2026-05-01",
      recentDailies: [],
      activeAlerts: [],
    });
    expect(state).toBe("quiet");
  });
});

describe("coverageCapForState", () => {
  it("scales cap per state", () => {
    expect(coverageCapForState("active")).toBe(3);
    expect(coverageCapForState("light")).toBe(2);
    expect(coverageCapForState("quiet")).toBe(1);
    expect(coverageCapForState("rough")).toBe(0);
  });
});

describe("computeCoverageGaps", () => {
  function settings(over: Partial<Settings> = {}): Settings {
    return {
      profile_name: "x",
      locale: "en",
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      ...over,
    };
  }

  it("returns no gaps and engagement=rough when red zone is active", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [alert("red")],
      snoozes: [],
    });
    expect(r.engagement).toBe("rough");
    expect(r.gaps).toEqual([]);
  });

  it("does not surface history_only fields the patient has never filled", () => {
    // Active engagement (logged today) but no prior weight/fluid/protein
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.engagement).toBe("active");
    // `digestion` is default-eligible so it CAN appear; history_only fields
    // (fluids, protein, walking, appetite, pert) should not.
    const keys = r.gaps.map((g) => g.field_key);
    expect(keys).not.toContain("fluids");
    expect(keys).not.toContain("protein");
    expect(keys).not.toContain("walking");
    expect(keys).not.toContain("appetite");
    expect(keys).not.toContain("pert_with_meals");
  });

  it("surfaces history_only fields once a prior entry shows history", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      // Today's entry deliberately fills `energy` (so the patient is
      // engagement=active and the `energy` field is fresh) but leaves
      // protein blank. A protein entry 5 days ago provides history.
      recentDailies: [
        entry("2026-05-01", { energy: 5 }),
        entry("2026-04-26", { protein_grams: 60 }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    const keys = r.gaps.map((g) => g.field_key);
    expect(keys).toContain("protein");
  });

  it("respects the daily cap from engagement state", () => {
    // Quiet state → cap 1. Even if many gaps qualify, only 1 surfaces.
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      // History across multiple history_only fields, but no recent log
      // → engagement=quiet.
      recentDailies: [
        entry("2026-04-15", {
          protein_grams: 60,
          fluids_ml: 1500,
          walking_minutes: 20,
          appetite: 5,
        }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.engagement).toBe("quiet");
    expect(r.gaps).toHaveLength(1);
  });

  it("hides a field while its snooze is active", () => {
    const snooze: CoverageSnoozeRow = {
      field_key: "digestion",
      snoozed_at: "2026-05-01T07:00:00Z",
      snoozed_until: "2026-05-04",
    };
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [snooze],
    });
    expect(r.gaps.some((g) => g.field_key === "digestion")).toBe(false);
  });

  it("re-surfaces the field after the snooze expires", () => {
    const snooze: CoverageSnoozeRow = {
      field_key: "digestion",
      snoozed_at: "2026-04-28T07:00:00Z",
      snoozed_until: "2026-04-30",
    };
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [snooze],
    });
    expect(r.gaps.some((g) => g.field_key === "digestion")).toBe(true);
  });

  it("emits a coverage card with a deep-link CTA into the right step", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [entry("2026-05-01", { energy: 5 })],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    const dig = r.gaps.find((g) => g.field_key === "digestion");
    expect(dig?.cta_href).toBe("/daily/new?step=digestion");
  });

  it("does not re-prompt a field that was already logged today", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      recentDailies: [
        entry("2026-05-01", { stool_count: 2, energy: 5 }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.gaps.some((g) => g.field_key === "digestion")).toBe(false);
    expect(r.gaps.some((g) => g.field_key === "energy")).toBe(false);
  });

  it("keeps weight prompt inside the 3-day freshness window", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      // Logged weight 2 days ago — still fresh, should not re-prompt.
      recentDailies: [
        entry("2026-05-01", { energy: 5 }),
        entry("2026-04-29", { weight_kg: 65 }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.gaps.some((g) => g.field_key === "weight")).toBe(false);
  });

  it("re-prompts weight after the 3-day freshness window expires", () => {
    const r = computeCoverageGaps({
      todayISO: "2026-05-01",
      // Last weigh-in 5 days ago — outside the 3-day window.
      recentDailies: [
        entry("2026-05-01", { energy: 5 }),
        entry("2026-04-26", { weight_kg: 65 }),
      ],
      settings: settings(),
      cycleContext: null,
      activeAlerts: [],
      snoozes: [],
    });
    expect(r.gaps.some((g) => g.field_key === "weight")).toBe(true);
  });
});
