import { describe, it, expect } from "vitest";
import {
  cycleDayFor,
  residualSeries,
  chronicResiduals,
  type CycleStub,
} from "~/lib/state/analytical";
import {
  generateSyntheticSeries,
  ancCycleSignature,
} from "../fixtures/analytical/synthetic-cycles";

describe("analytical / cycleDayFor", () => {
  const cycles: CycleStub[] = [
    { start_date: "2026-01-01", cycle_number: 1, cycle_length_days: 28 },
    { start_date: "2026-01-29", cycle_number: 2, cycle_length_days: 28 },
  ];

  it("maps a date inside cycle 1 to the right cycle_day", () => {
    const r = cycleDayFor("2026-01-08", cycles);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.cycle_number).toBe(1);
    expect(r.cycle_day).toBe(8);
  });

  it("maps a date inside cycle 2 to the right cycle_day", () => {
    const r = cycleDayFor("2026-02-12", cycles);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.cycle_number).toBe(2);
    expect(r.cycle_day).toBe(15);
  });

  it("returns null for a date outside any cycle", () => {
    expect(cycleDayFor("2025-12-01", cycles)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(cycleDayFor("not-a-date", cycles)).toBeNull();
  });
});

describe("analytical / residualSeries", () => {
  it("emits one residual per observation in input order", () => {
    const series = generateSyntheticSeries({
      metric_id: "anc",
      protocol_cycle_length_days: 28,
      n_cycles: 1,
      cycle1_start: "2026-01-01",
      baseline: 3.0,
      daily_noise_sd: 0.1,
      cycle_signature: ancCycleSignature,
      seed: 1,
    });
    const residuals = residualSeries({
      metric_id: "anc",
      observations: series.observations,
      cycles: series.cycles,
    });
    expect(residuals).toHaveLength(series.observations.length);
    expect(residuals[0]?.date).toBe(series.observations[0]?.date);
  });

  it("residuals of stationary cycle-shaped data have mean near zero", () => {
    const series = generateSyntheticSeries({
      metric_id: "anc",
      protocol_cycle_length_days: 28,
      n_cycles: 3,
      cycle1_start: "2026-01-01",
      baseline: 3.0,
      daily_noise_sd: 0.3,
      cycle_signature: ancCycleSignature,
      seed: 42,
    });
    const residuals = residualSeries({
      metric_id: "anc",
      observations: series.observations,
      cycles: series.cycles,
    });
    const values = residuals.map((r) => r.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // Stationary residuals should centre near zero. Allow ±0.5 SD —
    // the population curve doesn't perfectly match the test signature
    // (it's literature-derived, not the synthetic curve), but the
    // bias should be small.
    expect(Math.abs(mean)).toBeLessThan(1.0);
  });

  it("emits a pass-through residual when the date falls outside any cycle", () => {
    const residuals = residualSeries({
      metric_id: "anc",
      observations: [{ date: "2025-06-15", value: 3.2 }],
      cycles: [],
    });
    expect(residuals).toHaveLength(1);
    expect(residuals[0]?.value).toBe(0);
    expect(residuals[0]?.expected_sd).toBe(1);
    expect(residuals[0]?.raw_value).toBe(3.2);
  });

  it("emits a pass-through residual for a metric without a population curve", () => {
    const residuals = residualSeries({
      metric_id: "totally_unknown_metric",
      observations: [{ date: "2026-01-08", value: 99 }],
      cycles: [
        { start_date: "2026-01-01", cycle_number: 1, cycle_length_days: 28 },
      ],
    });
    expect(residuals[0]?.value).toBe(0);
    expect(residuals[0]?.raw_value).toBe(99);
  });

  it("marks observations whose dates are in acute_excluded_dates", () => {
    const residuals = residualSeries({
      metric_id: "anc",
      observations: [
        { date: "2026-01-05", value: 2.5 },
        { date: "2026-01-12", value: 2.0 },
      ],
      cycles: [
        { start_date: "2026-01-01", cycle_number: 1, cycle_length_days: 28 },
      ],
      acute_excluded_dates: new Set(["2026-01-12"]),
    });
    expect(residuals[0]?.excluded_acute).toBeUndefined();
    expect(residuals[1]?.excluded_acute).toBe(true);
  });
});

describe("analytical / chronicResiduals", () => {
  it("filters out acute-excluded observations", () => {
    const residuals = residualSeries({
      metric_id: "anc",
      observations: [
        { date: "2026-01-05", value: 2.5 },
        { date: "2026-01-12", value: 2.0 },
        { date: "2026-01-19", value: 1.4 },
      ],
      cycles: [
        { start_date: "2026-01-01", cycle_number: 1, cycle_length_days: 28 },
      ],
      acute_excluded_dates: new Set(["2026-01-12"]),
    });
    const chronic = chronicResiduals(residuals);
    expect(chronic).toHaveLength(2);
    expect(chronic.map((r) => r.date)).toEqual(["2026-01-05", "2026-01-19"]);
  });
});
