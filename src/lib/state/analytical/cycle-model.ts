// Cycle model — the semantic wrapper over the population priors loader.
//
// `cycle-curves.ts` reads + validates JSON. This module sits one layer
// up: it exposes `expectedFor()` which takes a cycle context (or its
// absence) and returns the right ExpectedPoint, blends in personal
// data when it exists, and stubs the personal-fit endpoint that
// arrives in v2.
//
// Right now this is a thin pass-through to the population priors with
// a deliberate hook for personal-blend logic. The blend is staged:
//
//   v1   — population priors only. `personalFit` always null.
//   v1.5 — personal SD swap once 4-6 weeks of clean residuals exist.
//          Mean stays population.
//   v2   — full GP fit on cycle history; mean + SD blended via
//          posterior shrinkage against `n_effective`.
//
// Detrend.ts is the only consumer; everything else reads through it.
import { expectedAt, expectedAtCycle } from "./cycle-curves";
import type { ExpectedPoint } from "./types";

export interface PersonalCycleFit {
  metric_id: string;
  fitted_at: string;
  // For each cycle_day 1..28, a personal posterior mean + sd. Sparse
  // arrays are allowed — undefined entries mean "no personal estimate
  // yet for this cycle_day", in which case the blend collapses to the
  // population value.
  posterior: Array<{ cycle_day: number; mean: number; sd: number } | undefined>;
  // How many distinct cycles contributed to the fit; used for
  // shrinkage weight against population n_effective.
  n_cycles_used: number;
}

/**
 * Bayesian-style shrinkage of a population estimate toward a personal
 * estimate. Both are assumed to be independent gaussians. The blend
 * weight is n_personal / (n_personal + n_population), where
 * n_population = `population.n_effective` (4-5 for strong literature,
 * 1 for weak) and n_personal scales linearly with `n_cycles_used`.
 *
 * If `personal` is null, returns the population point unchanged.
 * If population SD is zero (degenerate), returns personal verbatim.
 */
export function shrinkPersonalToPopulation(
  population: ExpectedPoint,
  personal: { mean: number; sd: number; n: number } | null,
): ExpectedPoint {
  if (!personal || personal.n <= 0) return population;
  const wPersonal = personal.n;
  const wPopulation = Math.max(1, population.n_effective);
  const total = wPersonal + wPopulation;
  const mean =
    (population.mean * wPopulation + personal.mean * wPersonal) / total;
  // SD blend: precision-weighted (inverse-variance) — under a normal
  // model, posterior precision = sum of component precisions.
  const popVar = population.sd * population.sd;
  const persVar = personal.sd * personal.sd;
  if (popVar === 0 || persVar === 0) {
    return {
      mean,
      sd: population.sd,
      n_effective: total,
      source: "blended",
    };
  }
  const blendedVar = 1 / (1 / popVar + 1 / persVar);
  const blendedSd = Math.sqrt(blendedVar);
  return {
    mean,
    sd: blendedSd,
    n_effective: total,
    source: "blended",
  };
}

/**
 * Look up the expected (mean, sd) for a metric at a given cycle context,
 * blending in personal data when it exists.
 *
 * Returns null when no population prior and no personal fit exist for
 * the requested cycle_day — in that case the caller should fall back
 * to a "no expected curve" residual (raw value, no detrending).
 */
export function expectedFor(args: {
  metric_id: string;
  cycle_day?: number;
  personal_fit?: PersonalCycleFit | null;
}): ExpectedPoint | null {
  const { metric_id, cycle_day, personal_fit } = args;
  if (cycle_day == null || !Number.isFinite(cycle_day)) return null;
  const population = expectedAt(metric_id, cycle_day);
  const personalPoint = personal_fit?.posterior?.[cycle_day - 1];
  const personal =
    personalPoint && personal_fit
      ? {
          mean: personalPoint.mean,
          sd: personalPoint.sd,
          n: personal_fit.n_cycles_used,
        }
      : null;
  if (!population) {
    // No population prior — if personal exists, expose it directly.
    if (!personal) return null;
    return {
      mean: personal.mean,
      sd: personal.sd,
      n_effective: personal.n,
      source: "personal",
    };
  }
  return shrinkPersonalToPopulation(population, personal);
}

/**
 * Cycle-number-keyed lookup for metrics like cumulative neuropathy.
 * Personal-data blending for these is deferred to v2 (insufficient
 * personal sample size at cycle resolution); for now this is a
 * straight pass-through to the population prior.
 */
export function expectedForCycle(args: {
  metric_id: string;
  cycle_number: number;
}): ExpectedPoint | null {
  const { metric_id, cycle_number } = args;
  if (!Number.isFinite(cycle_number) || cycle_number < 1) return null;
  return expectedAtCycle(metric_id, cycle_number);
}
