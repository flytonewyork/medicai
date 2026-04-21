import { describe, it, expect } from "vitest";
import {
  buildPatientState,
  extractObservationsByMetric,
  type BuildStateInputs,
} from "~/lib/state";
import {
  evaluateDetectors,
  reconcileSignals,
  stepsDeclineDetector,
  gripDeclineDetector,
  rankDifferential,
  metricDriftingAgainst,
  metricAtLeast,
  cycleDayBetween,
  type CandidateCause,
} from "~/lib/state/detectors";
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  Settings,
} from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeDaily(
  date: string,
  overrides: Partial<DailyEntry> = {},
): DailyEntry {
  return {
    date,
    entered_at: `${date}T08:00:00Z`,
    entered_by: "hulin",
    energy: 7,
    sleep_quality: 7,
    appetite: 7,
    pain_worst: 2,
    pain_current: 1,
    mood_clarity: 7,
    nausea: 1,
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
    created_at: `${date}T08:00:00Z`,
    updated_at: `${date}T08:00:00Z`,
    ...overrides,
  };
}

function makeFortnightly(
  date: string,
  overrides: Partial<FortnightlyAssessment> = {},
): FortnightlyAssessment {
  return {
    assessment_date: date,
    entered_at: `${date}T10:00:00Z`,
    entered_by: "hulin",
    ecog_self: 1,
    created_at: `${date}T10:00:00Z`,
    updated_at: `${date}T10:00:00Z`,
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    profile_name: "Hu Lin",
    locale: "en",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    baseline_weight_kg: 70,
    baseline_grip_dominant_kg: 40,
    baseline_gait_speed_ms: 1.2,
    ...overrides,
  };
}

function makeInputs(
  over: Partial<BuildStateInputs> = {},
): BuildStateInputs {
  return {
    as_of: "2026-04-15",
    settings: makeSettings(),
    dailies: [],
    fortnightlies: [],
    labs: [],
    cycles: [],
    ...over,
  };
}

function ctxFromInputs(inputs: BuildStateInputs) {
  return {
    state: buildPatientState(inputs),
    observations: extractObservationsByMetric(inputs),
    now: inputs.as_of,
  };
}

function synthDailiesWithSteps(
  startISO: string,
  steps: number[],
  overrides: Partial<DailyEntry> = {},
): DailyEntry[] {
  const out: DailyEntry[] = [];
  const start = new Date(startISO).getTime();
  steps.forEach((v, i) => {
    const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push(makeDaily(d, { steps: v, ...overrides }));
  });
  return out;
}

// ─── Differential helpers ──────────────────────────────────────────────────

describe("rankDifferential", () => {
  it("ranks causes with matched predicates above those without", () => {
    const causes: CandidateCause[] = [
      {
        id: "a",
        label: { en: "A", zh: "A" },
        predicates: [
          metricDriftingAgainst("energy", "lower", 20),
          metricDriftingAgainst("mood_clarity", "lower", 20),
        ],
      },
      {
        id: "b",
        label: { en: "B", zh: "B" },
        predicates: [metricAtLeast("nausea", 5)],
      },
    ];
    // 14 days at energy 8 (baseline) + 4 days at energy 3 (drift). Need
    // enough pre-drift history for rolling_14d / rolling_28d baseline to
    // settle high enough that pct_from_baseline shows a drop.
    const baselineDays = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(new Date("2026-03-29").getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return makeDaily(d, { energy: 8, mood_clarity: 8 });
    });
    const driftDays = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(new Date("2026-04-12").getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return makeDaily(d, { energy: 3, mood_clarity: 3 });
    });
    const inputs = makeInputs({ dailies: [...baselineDays, ...driftDays] });
    const state = buildPatientState(inputs);
    const ranked = rankDifferential(state, causes);
    expect(ranked[0].id).toBe("a");
    expect(ranked[0].supporting_metric_ids).toEqual(
      expect.arrayContaining(["energy", "mood_clarity"]),
    );
  });

  it("returns unlikely when required_supporters isn't met", () => {
    const causes: CandidateCause[] = [
      {
        id: "needs_two",
        label: { en: "needs two", zh: "需要两项" },
        required_supporters: 2,
        predicates: [
          metricAtLeast("nausea", 5),
          metricAtLeast("pain_current", 5),
        ],
      },
    ];
    const inputs = makeInputs({
      dailies: [makeDaily("2026-04-15", { nausea: 7, pain_current: 0 })],
    });
    const state = buildPatientState(inputs);
    const ranked = rankDifferential(state, causes);
    expect(ranked[0].confidence).toBe("unlikely");
  });

  it("cycleDayBetween predicate fires only in range", () => {
    const pred = cycleDayBetween(2, 7);
    const inCycleInputs = makeInputs({
      as_of: "2026-04-03",
      cycles: [
        {
          id: 1,
          protocol_id: "gnp_weekly",
          cycle_number: 1,
          start_date: "2026-04-01",
          status: "active",
          dose_level: 0,
          created_at: "",
          updated_at: "",
        } as TreatmentCycle,
      ],
    });
    const state = buildPatientState(inCycleInputs);
    expect(pred(state)).toBe("cycle_day");

    const outOfCycle = buildPatientState(makeInputs({ as_of: "2026-04-01" }));
    expect(pred(outOfCycle)).toBeNull();
  });
});

// ─── stepsDeclineDetector ─────────────────────────────────────────────────

describe("stepsDeclineDetector", () => {
  it("is silent when step data < MIN_OBSERVATIONS_FOR_VARIANCE", () => {
    const dailies = synthDailiesWithSteps("2026-04-12", [5000, 5000, 5000]);
    const ctx = ctxFromInputs(makeInputs({ dailies }));
    expect(stepsDeclineDetector.evaluate(ctx)).toEqual([]);
  });

  it("is silent when current rolling mean matches baseline", () => {
    const dailies = synthDailiesWithSteps(
      "2026-03-19",
      Array.from({ length: 28 }, () => 5000),
    );
    const ctx = ctxFromInputs(makeInputs({ dailies }));
    expect(stepsDeclineDetector.evaluate(ctx)).toEqual([]);
  });

  it("fires a caution signal when 7d mean drifts ≥1 SD below baseline for 5+ days", () => {
    // Baseline: 14 days at ~5000 ± small noise, then 14 days at 4200.
    // 14 drift days are needed so the 7-day rolling window sits entirely
    // inside the drift for ≥ MIN_DURATION_DAYS consecutive days.
    const baseline: number[] = [];
    for (let i = 0; i < 14; i++) {
      baseline.push(5000 + ((i % 3) - 1) * 120);
    }
    const drift: number[] = Array.from({ length: 14 }, () => 4200);
    const dailies = synthDailiesWithSteps("2026-03-19", [
      ...baseline,
      ...drift,
    ]);
    const ctx = ctxFromInputs(makeInputs({ dailies }));
    const signals = stepsDeclineDetector.evaluate(ctx);
    expect(signals).toHaveLength(1);
    const s = signals[0]!;
    expect(s.detector).toBe("steps_decline");
    expect(s.metric_id).toBe("steps");
    expect(s.axis).toBe("individual");
    expect(["caution", "warning"]).toContain(s.severity);
    expect(s.evidence.duration_days).toBeGreaterThanOrEqual(5);
    expect(s.evidence.sd_units).toBeLessThan(-1);
    expect(s.fired_for).toMatch(/^steps_decline:\d{4}-W\d{2}$/);
  });

  it("escalates to warning when drift ≥ 20% below baseline", () => {
    const baseline: number[] = Array.from({ length: 14 }, (_, i) =>
      5000 + ((i % 3) - 1) * 100,
    );
    const drift: number[] = Array.from({ length: 14 }, () => 3500); // big drop
    const dailies = synthDailiesWithSteps("2026-03-19", [
      ...baseline,
      ...drift,
    ]);
    const ctx = ctxFromInputs(makeInputs({ dailies }));
    const signals = stepsDeclineDetector.evaluate(ctx);
    expect(signals[0]!.severity).toBe("warning");
  });

  it("attaches a chemo_recovery differential when concurrent symptoms + cycle D2-D7", () => {
    const baseline: number[] = Array.from({ length: 14 }, (_, i) =>
      6000 + ((i % 3) - 1) * 150,
    );
    const drift: number[] = Array.from({ length: 14 }, () => 4500);
    const dailies = synthDailiesWithSteps("2026-03-19", [
      ...baseline,
      ...drift,
    ]);
    // Overlay nausea + low appetite on the last 5 days
    for (let i = dailies.length - 5; i < dailies.length; i++) {
      dailies[i] = {
        ...dailies[i]!,
        nausea: 6,
        appetite: 3,
        energy: 3,
      };
    }
    const cycle: TreatmentCycle = {
      id: 1,
      protocol_id: "gnp_weekly",
      cycle_number: 1,
      start_date: "2026-04-13",
      status: "active",
      dose_level: 0,
      created_at: "",
      updated_at: "",
    };
    const ctx = ctxFromInputs(makeInputs({ dailies, cycles: [cycle] }));
    const signal = stepsDeclineDetector.evaluate(ctx)[0]!;
    expect(signal.differential[0].id).toBe("chemo_recovery");
    expect(signal.differential[0].confidence).not.toBe("unlikely");
    expect(signal.actions.length).toBeGreaterThan(0);
  });

  it("reports resolved when rolling mean recovers to within 5% of baseline", () => {
    const baseline: number[] = Array.from({ length: 14 }, (_, i) =>
      5000 + ((i % 3) - 1) * 100,
    );
    const drift: number[] = Array.from({ length: 14 }, () => 4200);
    const droopy = synthDailiesWithSteps("2026-03-19", [...baseline, ...drift]);
    const ctxDroopy = ctxFromInputs(makeInputs({ dailies: droopy }));
    const emitted = stepsDeclineDetector.evaluate(ctxDroopy)[0]!;
    expect(emitted).toBeDefined();
    expect(stepsDeclineDetector.hasResolved(emitted, ctxDroopy)).toBe(false);

    const recovery: number[] = Array.from({ length: 7 }, () => 5000);
    const recovered = synthDailiesWithSteps(
      "2026-03-19",
      [...baseline, ...drift, ...recovery],
    );
    const ctxRecovered = ctxFromInputs(
      makeInputs({
        dailies: recovered,
        as_of: recovered[recovered.length - 1]!.date,
      }),
    );
    expect(stepsDeclineDetector.hasResolved(emitted, ctxRecovered)).toBe(true);
  });
});

// ─── gripDeclineDetector ──────────────────────────────────────────────────

describe("gripDeclineDetector", () => {
  it("is silent with fewer than 3 fortnightly observations", () => {
    const fortnightlies = [
      makeFortnightly("2026-03-01", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 39 }),
    ];
    const ctx = ctxFromInputs(makeInputs({ fortnightlies }));
    expect(gripDeclineDetector.evaluate(ctx)).toEqual([]);
  });

  it("is silent when slope is flat", () => {
    const fortnightlies = [
      makeFortnightly("2026-02-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-01", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-29", { grip_dominant_kg: 40 }),
    ];
    const ctx = ctxFromInputs(
      makeInputs({
        fortnightlies,
        as_of: "2026-04-01",
      }),
    );
    expect(gripDeclineDetector.evaluate(ctx)).toEqual([]);
  });

  it("fires caution when slope is meaningfully negative", () => {
    const fortnightlies = [
      makeFortnightly("2026-02-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-01", { grip_dominant_kg: 39 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 37.5 }),
      makeFortnightly("2026-03-29", { grip_dominant_kg: 36 }),
    ];
    const ctx = ctxFromInputs(
      makeInputs({ fortnightlies, as_of: "2026-04-01" }),
    );
    const signals = gripDeclineDetector.evaluate(ctx);
    expect(signals.length).toBe(1);
    expect(signals[0]!.metric_id).toBe("grip_dominant_kg");
    expect(signals[0]!.axis).toBe("individual");
  });

  it("surfaces cachexia as the top differential when weight + protein are also drifting", () => {
    const fortnightlies = [
      makeFortnightly("2026-02-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-01", { grip_dominant_kg: 38 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 36 }),
      makeFortnightly("2026-03-29", { grip_dominant_kg: 34 }),
    ];
    // Weight drift + low protein intake in recent dailies
    const dailies = [
      ...synthDailiesWithSteps(
        "2026-03-20",
        Array.from({ length: 13 }, () => 5000),
      ).map((d) => ({ ...d, weight_kg: 64, protein_grams: 45 })),
    ];
    const ctx = ctxFromInputs(
      makeInputs({
        fortnightlies,
        dailies,
        as_of: "2026-04-01",
      }),
    );
    const signal = gripDeclineDetector.evaluate(ctx)[0]!;
    const topLikely = signal.differential.find(
      (d) => d.confidence !== "unlikely",
    );
    expect(topLikely?.id).toBe("cachexia");
    expect(signal.actions.some((a) => a.ref_id === "nutrition.dietitian")).toBe(
      true,
    );
  });

  it("escalates to warning at ≥12% below pre-diagnosis baseline", () => {
    // Baseline 40 kg, drop to 34.5 kg = ~13.75% decline
    const fortnightlies = [
      makeFortnightly("2026-02-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-01", { grip_dominant_kg: 38 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 36 }),
      makeFortnightly("2026-03-29", { grip_dominant_kg: 34.5 }),
    ];
    const ctx = ctxFromInputs(
      makeInputs({ fortnightlies, as_of: "2026-04-01" }),
    );
    expect(gripDeclineDetector.evaluate(ctx)[0]!.severity).toBe("warning");
  });
});

// ─── Orchestration + reconciliation ──────────────────────────────────────

describe("evaluateDetectors + reconcileSignals", () => {
  it("evaluateDetectors runs every registered detector", () => {
    const stepsDailies = synthDailiesWithSteps("2026-03-19", [
      ...Array.from({ length: 14 }, () => 5000),
      ...Array.from({ length: 14 }, () => 4000),
    ]);
    const fortnightlies = [
      makeFortnightly("2026-02-15", { grip_dominant_kg: 40 }),
      makeFortnightly("2026-03-01", { grip_dominant_kg: 38 }),
      makeFortnightly("2026-03-15", { grip_dominant_kg: 36 }),
      makeFortnightly("2026-03-29", { grip_dominant_kg: 34.5 }),
    ];
    const ctx = ctxFromInputs(
      makeInputs({ dailies: stepsDailies, fortnightlies }),
    );
    const signals = evaluateDetectors(ctx);
    expect(signals.map((s) => s.detector).sort()).toEqual([
      "grip_decline",
      "steps_decline",
    ]);
  });

  it("reconcileSignals suppresses already-persisted signals", () => {
    const dailies = synthDailiesWithSteps("2026-03-19", [
      ...Array.from({ length: 14 }, () => 5000),
      ...Array.from({ length: 14 }, () => 4000),
    ]);
    const ctx = ctxFromInputs(makeInputs({ dailies }));
    const emitted = evaluateDetectors(ctx);
    expect(emitted.length).toBeGreaterThan(0);
    const persisted = emitted.map((s) => ({
      fired_for: s.fired_for,
      status: "open" as const,
    }));
    const { to_insert, to_resolve } = reconcileSignals(emitted, persisted, ctx);
    expect(to_insert).toEqual([]);
    expect(to_resolve).toEqual([]);
  });

  it("reconcileSignals marks stale open signals for resolution once drift recovers", () => {
    const base: number[] = Array.from({ length: 14 }, () => 5000);
    const dip: number[] = Array.from({ length: 14 }, () => 4000);
    const recovery: number[] = Array.from({ length: 7 }, () => 5000);

    // Drift phase — detector fires
    const driftCtx = ctxFromInputs(
      makeInputs({
        dailies: synthDailiesWithSteps("2026-03-19", [...base, ...dip]),
      }),
    );
    const emitted = evaluateDetectors(driftCtx);
    expect(emitted.length).toBeGreaterThan(0);

    // Recovery phase — reconcile against persisted signal
    const recoveryDailies = synthDailiesWithSteps("2026-03-19", [
      ...base,
      ...dip,
      ...recovery,
    ]);
    const recoveryCtx = ctxFromInputs(
      makeInputs({
        dailies: recoveryDailies,
        as_of: recoveryDailies[recoveryDailies.length - 1]!.date,
      }),
    );
    const persisted = emitted.map((s) => ({
      fired_for: s.fired_for,
      status: "open" as const,
    }));
    const { to_resolve } = reconcileSignals([], persisted, recoveryCtx);
    expect(to_resolve).toContain(persisted[0].fired_for);
  });
});
