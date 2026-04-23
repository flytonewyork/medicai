import { describe, it, expect } from "vitest";
import { buildPatientState, type BuildStateInputs } from "~/lib/state";
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  Settings,
} from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";

function makeDaily(
  date: string,
  overrides: Partial<DailyEntry> = {},
): DailyEntry {
  return {
    date,
    entered_at: `${date}T08:00:00Z`,
    entered_by: "hulin",
    energy: 6,
    sleep_quality: 6,
    appetite: 6,
    pain_worst: 3,
    pain_current: 2,
    mood_clarity: 6,
    nausea: 2,
    practice_morning_completed: true,
    practice_evening_completed: false,
    cold_dysaesthesia: false,
    neuropathy_hands: 0,
    neuropathy_feet: 0,
    mouth_sores: false,
    diarrhoea_count: 0,
    new_bruising: false,
    dyspnoea: false,
    fever: false,
    created_at: `${date}T08:00:00Z`,
    updated_at: `${date}T08:00:00Z`,
    ...overrides,
  };
}

function makeLab(
  date: string,
  overrides: Partial<LabResult> = {},
): LabResult {
  return {
    date,
    source: "epworth",
    created_at: `${date}T08:00:00Z`,
    updated_at: `${date}T08:00:00Z`,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    profile_name: "Hu Lin",
    locale: "en",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCycle(overrides: Partial<TreatmentCycle> = {}): TreatmentCycle {
  return {
    id: 1,
    protocol_id: "gnp_weekly",
    cycle_number: 1,
    start_date: "2026-04-01",
    status: "active",
    dose_level: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function baseInputs(): BuildStateInputs {
  return {
    as_of: "2026-04-15",
    settings: null,
    dailies: [],
    fortnightlies: [],
    labs: [],
    cycles: [],
  };
}

describe("buildPatientState — shape guarantees", () => {
  it("produces axis summaries for all four axes, even without data", () => {
    const s = buildPatientState(baseInputs());
    expect(Object.keys(s.axes).sort()).toEqual([
      "drug",
      "external",
      "individual",
      "tumour",
    ]);
    for (const axis of Object.values(s.axes)) {
      expect(axis.n_metrics_observed).toBe(0);
      expect(axis.score).toBeUndefined();
    }
  });

  it("produces a trajectory entry for every registered metric", () => {
    const s = buildPatientState(baseInputs());
    // Spot-check a handful across axes
    expect(s.metrics["weight_kg"]).toBeDefined();
    expect(s.metrics["nausea"]).toBeDefined();
    expect(s.metrics["ca199"]).toBeDefined();
    expect(s.metrics["neutrophils"]).toBeDefined();
    for (const t of Object.values(s.metrics)) {
      expect(t.sample_count).toBe(0);
      expect(t.value).toBeNull();
      expect(t.fresh).toBe(false);
    }
  });
});

describe("buildPatientState — extraction + trajectories", () => {
  it("extracts daily weights and computes pct_from_baseline against pre_diagnosis", () => {
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      settings: makeSettings({
        baseline_weight_kg: 70,
        baseline_date: "2025-12-01",
      }),
      dailies: [
        makeDaily("2026-04-10", { weight_kg: 69 }),
        makeDaily("2026-04-12", { weight_kg: 68 }),
        makeDaily("2026-04-14", { weight_kg: 67 }),
        makeDaily("2026-04-15", { weight_kg: 66.5 }),
      ],
    };
    const s = buildPatientState(inputs);
    const w = s.metrics["weight_kg"]!;
    expect(w.value).toBe(66.5);
    expect(w.sample_count).toBe(4);
    expect(w.baselines.pre_diagnosis?.value).toBe(70);
    expect(w.baseline_used).toBe("pre_diagnosis");
    expect(w.pct_from_baseline!).toBeCloseTo(((66.5 - 70) / 70) * 100, 4);
    expect(w.fresh).toBe(true);
  });

  it("computes a negative 7d slope when weight is falling", () => {
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      as_of: "2026-04-15",
      dailies: [
        makeDaily("2026-04-09", { weight_kg: 70 }),
        makeDaily("2026-04-11", { weight_kg: 69 }),
        makeDaily("2026-04-13", { weight_kg: 68 }),
        makeDaily("2026-04-15", { weight_kg: 67 }),
      ],
    };
    const s = buildPatientState(inputs);
    const w = s.metrics["weight_kg"]!;
    expect(w.slope_7d).not.toBeNull();
    expect(w.slope_7d!).toBeLessThan(0);
  });

  it("extracts labs and routes CA 19-9 to the tumour axis", () => {
    const s = buildPatientState({
      ...baseInputs(),
      labs: [
        makeLab("2026-01-15", { ca199: 400 }),
        makeLab("2026-02-15", { ca199: 300 }),
        makeLab("2026-03-15", { ca199: 180 }),
        makeLab("2026-04-14", { ca199: 120 }),
      ],
    });
    const t = s.metrics["ca199"]!;
    expect(t.axis).toBe("tumour");
    expect(t.value).toBe(120);
    expect(t.sample_count).toBe(4);
    // CA 19-9 is measured monthly — slope_28d may be null with only one
    // observation in the trailing 28d window, which is clinically realistic.
    const tumourSummary = s.axes.tumour;
    expect(tumourSummary.n_metrics_observed).toBeGreaterThanOrEqual(1);
  });

  it("routes ANC / platelets / LFTs to the drug axis", () => {
    const s = buildPatientState({
      ...baseInputs(),
      labs: [
        makeLab("2026-04-14", {
          neutrophils: 0.9,
          platelets: 80,
          hemoglobin: 105,
          alt: 140,
        }),
      ],
    });
    expect(s.metrics["neutrophils"]!.axis).toBe("drug");
    expect(s.metrics["platelets"]!.axis).toBe("drug");
    expect(s.metrics["alt"]!.axis).toBe("drug");
  });
});

describe("buildPatientState — cycle baselines", () => {
  it("populates pre_cycle baseline from the 7 days preceding cycle start", () => {
    const dailies = [
      makeDaily("2026-03-25", { weight_kg: 70 }),
      makeDaily("2026-03-27", { weight_kg: 70.2 }),
      makeDaily("2026-03-29", { weight_kg: 69.8 }),
      // Cycle starts 2026-04-01
      makeDaily("2026-04-05", { weight_kg: 69 }),
      makeDaily("2026-04-10", { weight_kg: 68 }),
      makeDaily("2026-04-15", { weight_kg: 67 }),
    ];
    const s = buildPatientState({
      ...baseInputs(),
      dailies,
      cycles: [makeCycle()],
    });
    const w = s.metrics["weight_kg"]!;
    expect(w.baselines.pre_cycle).toBeDefined();
    expect(w.baselines.pre_cycle!.value).toBeCloseTo(
      (70 + 70.2 + 69.8) / 3,
      4,
    );
  });

  it("populates cycle_matched baseline from the prior cycle's same day", () => {
    // Prior cycle: 2026-03-01 → 2026-03-28. Current cycle: 2026-04-01 → ongoing.
    // On 2026-04-08 (D8 of cycle 2), compare to D8 of cycle 1 (2026-03-08).
    const dailies = [
      makeDaily("2026-03-08", { weight_kg: 68 }),
      makeDaily("2026-04-07", { weight_kg: 67 }),
      makeDaily("2026-04-08", { weight_kg: 66 }),
    ];
    const cycles: TreatmentCycle[] = [
      makeCycle({
        id: 1,
        cycle_number: 1,
        start_date: "2026-03-01",
        status: "completed",
      }),
      makeCycle({
        id: 2,
        cycle_number: 2,
        start_date: "2026-04-01",
        status: "active",
      }),
    ];
    const s = buildPatientState({
      ...baseInputs(),
      as_of: "2026-04-08",
      dailies,
      cycles,
    });
    const w = s.metrics["weight_kg"]!;
    expect(w.baselines.cycle_matched).toBeDefined();
    expect(w.baselines.cycle_matched!.value).toBe(68);
    expect(s.cycle?.cycle_day).toBe(8);
  });

  it("resolves the active cycle and computes cycle_day correctly", () => {
    const s = buildPatientState({
      ...baseInputs(),
      as_of: "2026-04-08",
      cycles: [makeCycle({ start_date: "2026-04-01" })],
    });
    expect(s.cycle?.cycle_day).toBe(8);
    expect(s.cycle?.protocol_id).toBe("gnp_weekly");
    expect(s.cycle?.cycle_length_days).toBe(28);
  });
});

describe("buildPatientState — axis summaries", () => {
  it("flags a disrupted metric when pct_from_baseline exceeds 15% unhealthy", () => {
    // Weight (higher_better) down 20% from pre_diagnosis baseline.
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      settings: makeSettings({ baseline_weight_kg: 70 }),
      dailies: [
        makeDaily("2026-04-13", { weight_kg: 56 }),
        makeDaily("2026-04-14", { weight_kg: 56 }),
        makeDaily("2026-04-15", { weight_kg: 56 }),
      ],
    };
    const s = buildPatientState(inputs);
    expect(s.axes.individual.disrupted_metric_ids).toContain("weight_kg");
  });

  it("does not flag a metric without a baseline", () => {
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      // No settings baseline, and only 2 daily observations ⇒ no rolling baseline
      dailies: [
        makeDaily("2026-04-14", { weight_kg: 56 }),
        makeDaily("2026-04-15", { weight_kg: 56 }),
      ],
    };
    const s = buildPatientState(inputs);
    expect(s.axes.individual.disrupted_metric_ids).not.toContain("weight_kg");
  });

  it("produces an axis score when metrics have a baseline and fresh data", () => {
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      settings: makeSettings({ baseline_weight_kg: 70 }),
      dailies: [
        makeDaily("2026-04-13", { weight_kg: 70 }),
        makeDaily("2026-04-14", { weight_kg: 70 }),
        makeDaily("2026-04-15", { weight_kg: 70 }),
      ],
    };
    const s = buildPatientState(inputs);
    expect(typeof s.axes.individual.score).toBe("number");
    expect(s.axes.individual.score!).toBe(100);
  });

  it("treats stale data as not-fresh and excludes it from disruption flags", () => {
    const inputs: BuildStateInputs = {
      ...baseInputs(),
      as_of: "2026-04-15",
      settings: makeSettings({ baseline_weight_kg: 70 }),
      dailies: [makeDaily("2026-01-01", { weight_kg: 50 })], // very old
    };
    const s = buildPatientState(inputs);
    const w = s.metrics["weight_kg"]!;
    expect(w.fresh).toBe(false);
    expect(s.axes.individual.disrupted_metric_ids).not.toContain("weight_kg");
  });
});
