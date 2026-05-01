import { describe, it, expect } from "vitest";
import {
  expectedFor,
  expectedForCycle,
  shrinkPersonalToPopulation,
  type PersonalCycleFit,
} from "~/lib/state/analytical";

describe("analytical / expectedFor", () => {
  it("returns null when cycle_day is missing", () => {
    expect(expectedFor({ metric_id: "anc" })).toBeNull();
  });

  it("returns the population point when no personal fit is given", () => {
    const p = expectedFor({ metric_id: "anc", cycle_day: 18 });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.source).toBe("population");
  });

  it("blends personal and population when both exist", () => {
    const personal: PersonalCycleFit = {
      metric_id: "anc",
      fitted_at: "2026-04-01",
      posterior: Array.from({ length: 28 }, (_, i) =>
        i === 17 ? { cycle_day: 18, mean: 0.8, sd: 0.4 } : undefined,
      ),
      n_cycles_used: 3,
    };
    const p = expectedFor({
      metric_id: "anc",
      cycle_day: 18,
      personal_fit: personal,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.source).toBe("blended");
    // Population mean for ANC day 18 is 1.3; personal is 0.8 with weight 3
    // vs population n_effective=3. Blended mean should be close to 1.05.
    expect(p.mean).toBeGreaterThan(0.8);
    expect(p.mean).toBeLessThan(1.3);
  });

  it("returns the personal point directly when no population prior exists", () => {
    const personal: PersonalCycleFit = {
      metric_id: "ecog_self_rated",
      fitted_at: "2026-04-01",
      posterior: Array.from({ length: 28 }, (_, i) =>
        i === 0 ? { cycle_day: 1, mean: 1.0, sd: 0.3 } : undefined,
      ),
      n_cycles_used: 4,
    };
    const p = expectedFor({
      metric_id: "ecog_self_rated",
      cycle_day: 1,
      personal_fit: personal,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.source).toBe("personal");
    expect(p.mean).toBe(1.0);
  });
});

describe("analytical / expectedForCycle", () => {
  it("returns the cumulative-neuropathy population point", () => {
    const p = expectedForCycle({
      metric_id: "neuropathy_cumulative_by_cycle",
      cycle_number: 6,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.mean).toBeCloseTo(1.6, 1);
  });

  it("returns null for cycle_number < 1", () => {
    expect(
      expectedForCycle({
        metric_id: "neuropathy_cumulative_by_cycle",
        cycle_number: 0,
      }),
    ).toBeNull();
  });
});

describe("analytical / shrinkPersonalToPopulation", () => {
  const pop = { mean: 10, sd: 2, n_effective: 3, source: "population" as const };

  it("returns population unchanged when personal is null", () => {
    expect(shrinkPersonalToPopulation(pop, null)).toEqual(pop);
  });

  it("blends mean with the correct weights", () => {
    const result = shrinkPersonalToPopulation(pop, { mean: 6, sd: 2, n: 3 });
    // wPersonal=3, wPopulation=3 → mean = (10*3 + 6*3) / 6 = 8
    expect(result.mean).toBeCloseTo(8, 5);
    expect(result.source).toBe("blended");
  });

  it("blends precision-weighted SD when both have positive variance", () => {
    const result = shrinkPersonalToPopulation(pop, { mean: 6, sd: 2, n: 3 });
    // both var=4 → 1/(1/4 + 1/4) = 2 → sd = sqrt(2)
    expect(result.sd).toBeCloseTo(Math.sqrt(2), 5);
  });

  it("falls back to population SD when personal variance is zero", () => {
    const result = shrinkPersonalToPopulation(pop, { mean: 6, sd: 0, n: 3 });
    expect(result.sd).toBe(2);
  });
});
