import { describe, it, expect } from "vitest";
import {
  validateCycleCurves,
  expectedAt,
  expectedAtCycle,
  detectorGuards,
  patientOverride,
  regimen,
} from "~/lib/state/analytical";

describe("analytical / cycle-curves loader", () => {
  it("validates the JSON at module load without throwing", () => {
    expect(() => validateCycleCurves()).not.toThrow();
  });

  it("returns regimen metadata", () => {
    const r = regimen();
    expect(r.cycle_length_days).toBe(28);
    expect(r.dose_days).toEqual([1, 8, 15]);
  });
});

describe("analytical / expectedAt", () => {
  it("returns a population point for ANC at day 18 (nadir)", () => {
    const p = expectedAt("anc", 18);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.source).toBe("population");
    expect(p.mean).toBeCloseTo(1.3, 1);
    expect(p.sd).toBeGreaterThan(0);
    expect(p.n_effective).toBeGreaterThanOrEqual(1);
  });

  it("returns null for an unknown metric id", () => {
    expect(expectedAt("not_a_metric", 5)).toBeNull();
  });

  it("returns null for a cadence-only metric (CA 19-9)", () => {
    expect(expectedAt("ca199", 1)).toBeNull();
  });

  it("returns null when cycle_day is out of range", () => {
    expect(expectedAt("anc", 99)).toBeNull();
    expect(expectedAt("anc", 0)).toBeNull();
  });

  it("returns null when the per-day point has null mean/sd", () => {
    // ecog_self_rated has expected_mean: null per the file
    expect(expectedAt("ecog_self_rated", 1)).toBeNull();
  });
});

describe("analytical / expectedAtCycle", () => {
  it("returns a population point for cumulative neuropathy at cycle 5", () => {
    const p = expectedAtCycle("neuropathy_cumulative_by_cycle", 5);
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.mean).toBeCloseTo(1.4, 1);
  });

  it("returns null for cycle_number outside the curve", () => {
    expect(expectedAtCycle("neuropathy_cumulative_by_cycle", 99)).toBeNull();
  });
});

describe("analytical / detectorGuards", () => {
  it("exposes the survivor-bias guard on cumulative neuropathy", () => {
    const guards = detectorGuards("neuropathy_cumulative_by_cycle");
    expect(guards.no_auto_resolve_on_curve_flatten).toMatch(/selection bias/i);
  });

  it("returns an empty object for metrics without guards", () => {
    expect(detectorGuards("anc")).toEqual({});
  });
});

describe("analytical / patientOverride", () => {
  it("returns the biliary-stent override on CA 19-9", () => {
    const ov = patientOverride("ca199", "biliary_stent_present");
    expect(ov).not.toBeNull();
    if (!ov) return;
    expect(ov.noise_band_pct).toBe(50);
    expect(ov.meaningful_change_band_pct).toBe(100);
  });

  it("returns null for a metric without overrides", () => {
    expect(patientOverride("anc", "biliary_stent_present")).toBeNull();
  });
});
