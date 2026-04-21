import { describe, it, expect } from "vitest";
import {
  buildPatientState,
  extractObservationsByMetric,
  type BuildStateInputs,
} from "~/lib/state";
import {
  socialIsolationDetector,
  clinicianGapDetector,
} from "~/lib/state/detectors";
import type { CareTeamContact, DailyEntry } from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";

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

function synthDaysWithInteractions(
  startISO: string,
  values: number[],
  overrides: Partial<DailyEntry> = {},
): DailyEntry[] {
  const out: DailyEntry[] = [];
  const start = new Date(startISO).getTime();
  values.forEach((v, i) => {
    const d = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push(
      makeDaily(d, {
        meaningful_interactions: v,
        carer_present: v > 0,
        ...overrides,
      }),
    );
  });
  return out;
}

function ctxFromInputs(
  inputs: BuildStateInputs,
  care_team_contacts: CareTeamContact[] = [],
) {
  return {
    state: buildPatientState(inputs),
    observations: extractObservationsByMetric(inputs),
    care_team_contacts,
    now: inputs.as_of,
  };
}

const EMPTY_INPUTS: BuildStateInputs = {
  as_of: "2026-04-15",
  settings: null,
  dailies: [],
  fortnightlies: [],
  labs: [],
  cycles: [],
};

// ─── socialIsolationDetector ──────────────────────────────────────────────

describe("socialIsolationDetector", () => {
  it("is silent without enough history", () => {
    const dailies = synthDaysWithInteractions("2026-04-10", [4, 4, 4]);
    const ctx = ctxFromInputs({ ...EMPTY_INPUTS, dailies });
    expect(socialIsolationDetector.evaluate(ctx)).toEqual([]);
  });

  it("fires when interactions drop ≥30% below reference for ≥5 consecutive days", () => {
    // 14 days baseline at 5 interactions/day, then 14 days at 2 interactions/day
    const dailies = synthDaysWithInteractions("2026-03-19", [
      ...Array.from({ length: 14 }, () => 5),
      ...Array.from({ length: 14 }, () => 2),
    ]);
    const ctx = ctxFromInputs({ ...EMPTY_INPUTS, dailies });
    const signals = socialIsolationDetector.evaluate(ctx);
    expect(signals).toHaveLength(1);
    const s = signals[0]!;
    expect(s.detector).toBe("social_isolation");
    expect(s.axis).toBe("external");
    expect(s.severity).toBe("warning"); // 2/5 = 60% drop
    expect(s.fired_for).toMatch(/^social_isolation:\d{4}-W\d{2}$/);
  });

  it("escalates to warning when drop is ≥50%", () => {
    const dailies = synthDaysWithInteractions("2026-03-19", [
      ...Array.from({ length: 14 }, () => 6),
      ...Array.from({ length: 14 }, () => 1),
    ]);
    const ctx = ctxFromInputs({ ...EMPTY_INPUTS, dailies });
    expect(socialIsolationDetector.evaluate(ctx)[0]!.severity).toBe("warning");
  });

  it("attaches mood_withdrawal differential when concurrent mood + sleep drop", () => {
    // Long clean baseline at high contact + mood + sleep
    const baseline = synthDaysWithInteractions(
      "2026-03-01",
      Array.from({ length: 28 }, () => 5),
      { mood_clarity: 8, sleep_quality: 8 },
    );
    // Recent drift in ALL three
    const drift = synthDaysWithInteractions(
      "2026-03-29",
      Array.from({ length: 8 }, () => 2),
      { mood_clarity: 3, sleep_quality: 3 },
    );
    const ctx = ctxFromInputs({
      ...EMPTY_INPUTS,
      as_of: "2026-04-05",
      dailies: [...baseline, ...drift],
    });
    const signal = socialIsolationDetector.evaluate(ctx)[0]!;
    const top = signal.differential.find((d) => d.confidence !== "unlikely");
    expect(top?.id).toBe("mood_withdrawal");
  });

  it("auto-resolves when interactions recover", () => {
    const dailies = synthDaysWithInteractions("2026-03-19", [
      ...Array.from({ length: 14 }, () => 5),
      ...Array.from({ length: 14 }, () => 2),
    ]);
    const ctxDroopy = ctxFromInputs({ ...EMPTY_INPUTS, dailies });
    const emitted = socialIsolationDetector.evaluate(ctxDroopy)[0]!;
    expect(socialIsolationDetector.hasResolved(emitted, ctxDroopy)).toBe(false);

    const recovered = synthDaysWithInteractions("2026-03-19", [
      ...Array.from({ length: 14 }, () => 5),
      ...Array.from({ length: 14 }, () => 2),
      ...Array.from({ length: 7 }, () => 5),
    ]);
    const ctxRecovered = ctxFromInputs({
      ...EMPTY_INPUTS,
      as_of: recovered[recovered.length - 1]!.date,
      dailies: recovered,
    });
    expect(
      socialIsolationDetector.hasResolved(emitted, ctxRecovered),
    ).toBe(true);
  });
});

// ─── clinicianGapDetector ─────────────────────────────────────────────────

function contact(
  date: string,
  overrides: Partial<CareTeamContact> = {},
): CareTeamContact {
  return {
    date,
    kind: "clinic_visit",
    created_at: `${date}T09:00:00Z`,
    updated_at: `${date}T09:00:00Z`,
    ...overrides,
  };
}

function activeCycle(start_date = "2026-04-01"): TreatmentCycle {
  return {
    id: 1,
    protocol_id: "gnp_weekly",
    cycle_number: 1,
    start_date,
    status: "active",
    dose_level: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("clinicianGapDetector", () => {
  it("is silent when no contacts have been logged", () => {
    const ctx = ctxFromInputs(EMPTY_INPUTS, []);
    expect(clinicianGapDetector.evaluate(ctx)).toEqual([]);
  });

  it("is silent when last contact is within active-cycle caution window (14d)", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-15",
      cycles: [activeCycle("2026-04-01")],
    };
    const ctx = ctxFromInputs(inputs, [contact("2026-04-10")]);
    expect(clinicianGapDetector.evaluate(ctx)).toEqual([]);
  });

  it("fires caution at 14 days since last contact during active cycle", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-15",
      cycles: [activeCycle("2026-04-01")],
    };
    const ctx = ctxFromInputs(inputs, [contact("2026-04-01")]);
    const signals = clinicianGapDetector.evaluate(ctx);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.severity).toBe("caution");
    expect(signals[0]!.axis).toBe("external");
    expect(signals[0]!.evidence.current_value).toBe(14);
  });

  it("escalates to warning at 21+ days during active cycle", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-25",
      cycles: [activeCycle("2026-04-01")],
    };
    const ctx = ctxFromInputs(inputs, [contact("2026-04-01")]);
    expect(clinicianGapDetector.evaluate(ctx)[0]!.severity).toBe("warning");
  });

  it("uses a longer threshold when no active cycle (maintenance)", () => {
    // 20 days gap + no cycle = below the 28d maintenance caution threshold.
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-21",
    };
    const ctx = ctxFromInputs(inputs, [contact("2026-04-01")]);
    expect(clinicianGapDetector.evaluate(ctx)).toEqual([]);
  });

  it("fires at 28+ days without an active cycle", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-29",
    };
    const ctx = ctxFromInputs(inputs, [contact("2026-04-01")]);
    const signals = clinicianGapDetector.evaluate(ctx);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.severity).toBe("caution");
  });

  it("auto-resolves once a new contact is logged within the caution window", () => {
    const inputs = {
      ...EMPTY_INPUTS,
      as_of: "2026-04-15",
      cycles: [activeCycle("2026-04-01")],
    };
    const ctxOpen = ctxFromInputs(inputs, [contact("2026-04-01")]);
    const emitted = clinicianGapDetector.evaluate(ctxOpen)[0]!;

    const ctxResolved = ctxFromInputs(inputs, [
      contact("2026-04-01"),
      contact("2026-04-14"),
    ]);
    expect(clinicianGapDetector.hasResolved(emitted, ctxResolved)).toBe(true);
  });
});
