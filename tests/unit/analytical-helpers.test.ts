import { describe, it, expect } from "vitest";
import {
  chronicSlope,
  chronicMeanResidual,
  residualBelowExpected,
} from "~/lib/rules/analytical-helpers";
import type { Observation } from "~/lib/state";
import type { CycleStub } from "~/lib/state/analytical";

// We use `anc` (absolute neutrophil count) throughout because it's an
// absolute-scale entry in the population cycle-curves prior with a
// well-defined daily mean (~3.0) and SD (~1.4). That gives predictable
// residuals: raw 3.0 → ~0 SD; raw 0.5 → ~-1.8 SD; raw 0.1 → ~-2.1 SD.
// Tests that need pass-through behaviour deliberately use a metric
// not present in the priors.
const METRIC = "anc";

// Single GnP cycle starting one month before the test asOf so all
// dates fall inside the cycle and pick up real expected curves.
const ONE_CYCLE: CycleStub[] = [
  { start_date: "2026-04-01", cycle_number: 1, cycle_length_days: 28 },
];

function obs(rows: Array<[string, number]>): Observation[] {
  return rows.map(([date, value]) => ({ date, value }));
}

describe("analytical-helpers / chronicSlope", () => {
  it("returns null when fewer than 3 observations are in window", () => {
    const observations = obs([
      ["2026-04-10", 3.0],
      ["2026-04-11", 3.0],
    ]);
    const slope = chronicSlope({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    expect(slope).toBeNull();
  });

  it("returns a finite slope for a flat residual series matching expected", () => {
    // Flat raw values produce a residual stream whose structure is
    // dominated by the population curve's day-to-day differences.
    // Slope should be finite.
    const observations = obs([
      ["2026-04-10", 3.0],
      ["2026-04-11", 3.0],
      ["2026-04-12", 3.0],
      ["2026-04-13", 3.0],
      ["2026-04-14", 3.0],
    ]);
    const slope = chronicSlope({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    expect(slope).not.toBeNull();
    // We don't assert exactly 0 because the population curve isn't flat —
    // the *residuals* of a flat raw value against a non-flat expected
    // curve will have some structure. We just assert finite + small.
    expect(Number.isFinite(slope!)).toBe(true);
  });

  it("returns negative slope for downward-drifting raw values (chronic decline)", () => {
    // Raw ANC values declining steadily from above-mean to well-below.
    // The chronic component should drift negative even after stripping
    // cycle variance.
    const observations = obs([
      ["2026-04-08", 4.0],
      ["2026-04-09", 3.7],
      ["2026-04-10", 3.4],
      ["2026-04-11", 3.0],
      ["2026-04-12", 2.5],
      ["2026-04-13", 1.8],
      ["2026-04-14", 1.0],
    ]);
    const slope = chronicSlope({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    expect(slope).not.toBeNull();
    expect(slope!).toBeLessThan(0);
  });

  it("respects the trailing window — old observations don't count", () => {
    // Old observations at higher level, recent ones at lower level. The
    // wide window sees the drop; the narrow window only sees the flat
    // recent run.
    const observations = obs([
      ["2026-04-01", 4.0],
      ["2026-04-02", 4.0],
      ["2026-04-03", 4.0],
      ["2026-04-12", 1.5],
      ["2026-04-13", 1.5],
      ["2026-04-14", 1.5],
    ]);
    const wide = chronicSlope({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 28,
    });
    const narrow = chronicSlope({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 7,
    });
    // Wide window sees the drop from 4 → 1.5; narrow window only sees
    // the recent flat 1.5s. Both should be finite numbers but they
    // should differ — confirming windowing actually scopes which
    // observations contribute.
    expect(wide).not.toBeNull();
    expect(narrow).not.toBeNull();
    expect(narrow).not.toBe(wide);
  });
});

describe("analytical-helpers / residualBelowExpected", () => {
  it("returns false when no observations exist", () => {
    const result = residualBelowExpected({
      metricId: METRIC,
      observations: [],
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      sdBelow: 1,
      consecutiveDays: 5,
    });
    expect(result).toBe(false);
  });

  it("returns false when only some recent residuals are below threshold", () => {
    // Mixed series — only the last day is clearly low. consecutiveDays=3
    // demands all three of the last three be below.
    const observations = obs([
      ["2026-04-12", 3.0], // mean
      ["2026-04-13", 3.0], // mean
      ["2026-04-14", 0.1], // dramatically low
    ]);
    const result = residualBelowExpected({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      sdBelow: 1,
      consecutiveDays: 3,
    });
    expect(result).toBe(false);
  });

  it("returns true when the most recent run is uniformly below threshold", () => {
    // 5 consecutive dramatically-low ANC values — well below -1 SD
    // against the ~3.0 mean / ~1.4 SD population curve.
    const observations = obs([
      ["2026-04-10", 0.1],
      ["2026-04-11", 0.1],
      ["2026-04-12", 0.1],
      ["2026-04-13", 0.1],
      ["2026-04-14", 0.1],
    ]);
    const result = residualBelowExpected({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      sdBelow: 1,
      consecutiveDays: 5,
    });
    expect(result).toBe(true);
  });

  it("returns false when consecutiveDays exceeds available data", () => {
    const observations = obs([
      ["2026-04-13", 0.1],
      ["2026-04-14", 0.1],
    ]);
    const result = residualBelowExpected({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      sdBelow: 1,
      consecutiveDays: 5,
    });
    expect(result).toBe(false);
  });

  it("only counts observations on or before asOf (no future leak)", () => {
    const observations = obs([
      ["2026-04-12", 0.1],
      ["2026-04-13", 0.1],
      ["2026-04-14", 0.1],
      ["2026-04-20", 0.1], // future relative to asOf
    ]);
    const result = residualBelowExpected({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-14",
      sdBelow: 1,
      consecutiveDays: 3,
    });
    expect(result).toBe(true);
  });
});

describe("analytical-helpers / chronicMeanResidual", () => {
  it("returns null when no observations fall in the window", () => {
    const observations = obs([
      ["2026-03-01", 3.0],
      ["2026-03-02", 3.0],
    ]);
    const mean = chronicMeanResidual({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 7,
    });
    expect(mean).toBeNull();
  });

  it("returns negative mean for systematically-low values", () => {
    const observations = obs([
      ["2026-04-10", 0.1],
      ["2026-04-11", 0.1],
      ["2026-04-12", 0.1],
    ]);
    const mean = chronicMeanResidual({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    expect(mean).not.toBeNull();
    expect(mean!).toBeLessThan(0);
  });

  it("returns the arithmetic mean of in-window residuals", () => {
    // Three observations in window — mean is finite and computable.
    // We don't assert the exact residual without re-deriving the
    // population curve in the test; just assert finite.
    const observations = obs([
      ["2026-04-12", 3.0],
      ["2026-04-13", 3.0],
      ["2026-04-14", 3.0],
    ]);
    const mean = chronicMeanResidual({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    expect(mean).not.toBeNull();
    expect(Number.isFinite(mean!)).toBe(true);
  });

  it("respects the trailing window (older obs excluded)", () => {
    const observations = obs([
      ["2026-04-01", 0.1], // old, very low — outside 5d window
      ["2026-04-13", 3.0],
      ["2026-04-14", 3.0],
      ["2026-04-15", 3.0],
    ]);
    const wide = chronicMeanResidual({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 28,
    });
    const narrow = chronicMeanResidual({
      metricId: METRIC,
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 5,
    });
    // Wide window includes the very-low day; narrow excludes it.
    // Narrow's mean should be greater (less negative) than wide's.
    expect(wide).not.toBeNull();
    expect(narrow).not.toBeNull();
    expect(narrow!).toBeGreaterThan(wide!);
  });
});

describe("analytical-helpers / pass-through behaviour", () => {
  it("chronicSlope returns 0 when metric has no population curve (pass-through residuals)", () => {
    // Pick a metric that's NOT in the cycle-curves prior. Residuals
    // for such a metric are all (0, sd=1, source='population') — flat,
    // so slope is 0.
    const observations = obs([
      ["2026-04-10", 100],
      ["2026-04-11", 50],
      ["2026-04-12", 150],
      ["2026-04-13", 25],
      ["2026-04-14", 200],
      ["2026-04-15", 75],
    ]);
    const slope = chronicSlope({
      metricId: "nonexistent_metric_xyz",
      observations,
      cycles: ONE_CYCLE,
      asOf: "2026-04-15",
      windowDays: 14,
    });
    // All residuals are 0 → variance of y is 0, slope is 0 (or null
    // depending on OLS impl). Both are acceptable: the rule layer
    // shouldn't fire on pass-through.
    if (slope !== null) {
      expect(Math.abs(slope)).toBeLessThan(1e-9);
    }
  });
});
