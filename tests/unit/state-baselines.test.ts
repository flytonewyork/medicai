import { describe, it, expect } from "vitest";
import {
  cycleMatchedBaseline,
  fixedBaseline,
  preCycleBaseline,
  preDiagnosisBaseline,
  preferredBaseline,
  rollingBaseline,
} from "~/lib/state/baselines";
import type { Baseline, Observation } from "~/lib/state/types";

function obs(date: string, value: number): Observation {
  return { date, value };
}

describe("rollingBaseline", () => {
  const series = [
    obs("2026-04-01", 70),
    obs("2026-04-05", 72),
    obs("2026-04-10", 71),
    obs("2026-04-14", 69),
    obs("2026-04-15", 80), // asOf day — excluded
  ];

  it("excludes the asOf day itself", () => {
    const b = rollingBaseline(series, "2026-04-15", 14);
    expect(b).not.toBeNull();
    expect(b!.value).toBeCloseTo((70 + 72 + 71 + 69) / 4, 6);
  });

  it("tags the window and sample count", () => {
    const b = rollingBaseline(series, "2026-04-15", 14);
    expect(b!.kind).toBe("rolling_14d");
    expect(b!.n).toBe(4);
    expect(b!.window_end).toBe("2026-04-14");
  });

  it("returns null when fewer than minN observations fit", () => {
    const b = rollingBaseline(series, "2026-04-03", 14);
    // Window is [03-20, 04-02]; only 04-01 qualifies ⇒ 1 obs, below minN=3
    expect(b).toBeNull();
  });

  it("distinguishes rolling_14d from rolling_28d by window size", () => {
    const b = rollingBaseline(series, "2026-04-15", 28);
    expect(b!.kind).toBe("rolling_28d");
  });
});

describe("preCycleBaseline", () => {
  it("uses the 7 days preceding cycle start", () => {
    const series = [
      obs("2026-03-20", 70),
      obs("2026-03-25", 71),
      obs("2026-03-28", 72),
      obs("2026-03-30", 70),
      obs("2026-04-01", 80), // cycle start — excluded
      obs("2026-04-03", 85),
    ];
    const b = preCycleBaseline(series, "2026-04-01");
    expect(b!.value).toBeCloseTo((71 + 72 + 70) / 3, 6);
    expect(b!.kind).toBe("pre_cycle");
    expect(b!.n).toBe(3);
  });

  it("returns null when < minN observations precede the cycle", () => {
    const series = [obs("2026-03-31", 70)];
    expect(preCycleBaseline(series, "2026-04-01")).toBeNull();
  });
});

describe("cycleMatchedBaseline", () => {
  const series = [
    obs("2026-02-01", 70), // prior cycle D1
    obs("2026-02-08", 68), // prior cycle D8
    obs("2026-02-14", 64), // prior cycle D14
    obs("2026-02-15", 63), // prior cycle D15
    obs("2026-03-01", 67), // current cycle D1
  ];

  it("reads the same cycle_day of the prior cycle (±1 day)", () => {
    // Current cycle_day = 8 → look at D8 of cycle starting 2026-02-01 (Feb 8)
    const b = cycleMatchedBaseline(series, "2026-02-01", 8);
    expect(b).not.toBeNull();
    expect(b!.value).toBeCloseTo(68, 6);
    expect(b!.kind).toBe("cycle_matched");
  });

  it("averages across a ±1-day window when multiple values land near target", () => {
    // Current cycle_day = 15 → prior cycle D15 ≈ Feb 15; D14 and D15 both hit.
    const b = cycleMatchedBaseline(series, "2026-02-01", 15);
    expect(b!.value).toBeCloseTo((64 + 63) / 2, 6);
  });

  it("returns null when no prior cycle start provided", () => {
    expect(cycleMatchedBaseline(series, null, 8)).toBeNull();
  });

  it("returns null when no data lands near the matched day", () => {
    const b = cycleMatchedBaseline(series, "2026-02-01", 21);
    expect(b).toBeNull();
  });
});

describe("preDiagnosisBaseline", () => {
  it("wraps a finite scalar as a pre_diagnosis baseline", () => {
    const b = preDiagnosisBaseline(72.5, "2025-12-01");
    expect(b).not.toBeNull();
    expect(b!.value).toBe(72.5);
    expect(b!.kind).toBe("pre_diagnosis");
    expect(b!.window_start).toBe("2025-12-01");
  });

  it("returns null for undefined / non-finite values", () => {
    expect(preDiagnosisBaseline(undefined)).toBeNull();
    expect(preDiagnosisBaseline(NaN)).toBeNull();
  });
});

describe("preferredBaseline", () => {
  it("picks pre_diagnosis over pre_cycle over rolling_28d", () => {
    const baselines: Partial<Record<Baseline["kind"], Baseline>> = {
      rolling_14d: { kind: "rolling_14d", value: 1 },
      rolling_28d: { kind: "rolling_28d", value: 2 },
      pre_cycle: { kind: "pre_cycle", value: 3 },
      pre_diagnosis: { kind: "pre_diagnosis", value: 4 },
    };
    expect(preferredBaseline(baselines)?.kind).toBe("pre_diagnosis");
  });

  it("falls back to rolling_28d when pre_diagnosis + pre_cycle absent", () => {
    const baselines: Partial<Record<Baseline["kind"], Baseline>> = {
      rolling_14d: { kind: "rolling_14d", value: 1 },
      rolling_28d: { kind: "rolling_28d", value: 2 },
    };
    expect(preferredBaseline(baselines)?.kind).toBe("rolling_28d");
  });

  it("returns null when the map is empty", () => {
    expect(preferredBaseline({})).toBeNull();
  });
});

describe("fixedBaseline", () => {
  it("produces a fixed baseline with n=1", () => {
    const b = fixedBaseline(1.2);
    expect(b.kind).toBe("fixed");
    expect(b.value).toBe(1.2);
    expect(b.n).toBe(1);
  });
});
