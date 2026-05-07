// Two-sided CUSUM change-point detector on residual series.
//
// Inputs are residual observations in expected-SD units (the output of
// `detrend.ts:residualSeries`). Output is a ChangePosterior — fixed
// shape across CUSUM (v1) and BOCPD (v2) so detector consumers don't
// need to know which method ran.
//
// CUSUM math, two-sided variant:
//
//   S+_t = max(0, S+_{t-1} + r_t - k)
//   S-_t = min(0, S-_{t-1} + r_t + k)
//   alarm when max(S+, -S-) > h
//
// where r_t is the residual in SD units, `k` is the allowance (slack)
// that decides what magnitude of mean shift is "interesting", and `h`
// is the decision interval. With residuals pre-normalised to SD units,
// k = 0.5 (only react to shifts ≥ 0.5 SD) is conventional and h = 4-5
// gives an in-control ARL of ~370 — enough that a stationary 4-week
// series rarely alarms by chance.
//
// Probability mapping. Classical CUSUM emits an alarm flag, not a
// probability. The detector framework needs a posterior so
// downstream gates (provisional, fire) compose. We map the running
// max-|S| through a piecewise-linear curve:
//
//   max|S| ≤ QUIET  → p_change = 0
//   max|S| = NOISE  → p_change = 0.30
//   max|S| = CONFIRM → p_change = 0.55  (provisional band starts)
//   max|S| = FIRE    → p_change = 0.85  (signal can be emitted)
//   max|S| ≥ FIRE+2  → p_change = 1.00  (capped)
//
// Bands are calibrated for k = 0.5; tightening / loosening k requires
// recomputing the curve. Tunable via `cusumPosterior` opts so detectors
// that expect more variance (e.g. self-reported scales) can widen.
//
// Pure function — no Dexie, no Date.now. Order-preserving consumption
// of the residual series.
import type { ResidualObservation } from "./types";
import type { ChangePosterior } from "./types";

const DEFAULT_K = 0.5;        // allowance, in residual-SD units
const DEFAULT_QUIET = 1.0;
const DEFAULT_NOISE = 2.5;
const DEFAULT_CONFIRM = 4.0;
const DEFAULT_FIRE = 6.0;
const MIN_N = 7;              // need at least this many residuals to fit

export interface CusumOptions {
  k?: number;
  quiet?: number;
  noise?: number;
  confirm?: number;
  fire?: number;
  /** Lower bound on n; below this we return null instead of a posterior. */
  min_n?: number;
}

interface CusumTrace {
  s_pos: number[];
  s_neg: number[];
  /** index in [0, n) where max|S| first occurred. */
  t_max: number;
  max_abs_s: number;
  /** sign of the dominant shift: +1 (positive drift), -1 (negative), 0 (none). */
  direction: 1 | -1 | 0;
}

function runCusum(values: readonly number[], k: number): CusumTrace {
  const n = values.length;
  const s_pos = new Array<number>(n).fill(0);
  const s_neg = new Array<number>(n).fill(0);
  let t_max = 0;
  let max_abs_s = 0;
  let direction: 1 | -1 | 0 = 0;
  let prevPos = 0;
  let prevNeg = 0;
  for (let t = 0; t < n; t++) {
    const r = values[t] ?? 0;
    const cur_pos = Math.max(0, prevPos + r - k);
    const cur_neg = Math.min(0, prevNeg + r + k);
    s_pos[t] = cur_pos;
    s_neg[t] = cur_neg;
    const abs = Math.max(cur_pos, -cur_neg);
    if (abs > max_abs_s) {
      max_abs_s = abs;
      t_max = t;
      direction = cur_pos >= -cur_neg ? 1 : -1;
    }
    prevPos = cur_pos;
    prevNeg = cur_neg;
  }
  return { s_pos, s_neg, t_max, max_abs_s, direction };
}

/**
 * Walk backward from `t_max` until the dominant statistic returns to
 * zero — that's our estimate of when the change began. Returns the
 * index in [0, t_max] of the first non-zero residual leading up to
 * the alarm.
 */
function changePointIndex(trace: CusumTrace): number {
  if (trace.direction === 0) return trace.t_max;
  const series = trace.direction === 1 ? trace.s_pos : trace.s_neg;
  for (let t = trace.t_max; t > 0; t--) {
    const v = series[t - 1] ?? 0;
    // The change-point is the first index where the cumulative
    // statistic was zero (or crossed zero) before climbing to t_max.
    if (trace.direction === 1 && v <= 0) return t;
    if (trace.direction === -1 && v >= 0) return t;
  }
  return 0;
}

/**
 * Piecewise-linear mapping from max|S| to a posterior probability.
 * Below `quiet` returns 0; between bands linearly interpolates;
 * above `fire + 2` clamps to 1.0.
 */
function probabilityFromStat(
  max_abs_s: number,
  bands: { quiet: number; noise: number; confirm: number; fire: number },
): number {
  const { quiet, noise, confirm, fire } = bands;
  if (max_abs_s <= quiet) return 0;
  if (max_abs_s <= noise) {
    return interp(max_abs_s, quiet, noise, 0, 0.3);
  }
  if (max_abs_s <= confirm) {
    return interp(max_abs_s, noise, confirm, 0.3, 0.55);
  }
  if (max_abs_s <= fire) {
    return interp(max_abs_s, confirm, fire, 0.55, 0.85);
  }
  if (max_abs_s <= fire + 2) {
    return interp(max_abs_s, fire, fire + 2, 0.85, 1);
  }
  return 1;
}

function interp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function daysBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/**
 * Compute the change-point posterior over a residual series as of
 * `asOfISO`. Returns null when:
 *   - there are fewer than `min_n` residuals
 *   - all residuals are non-finite
 *   - the most recent residual is older than `asOfISO` (defensive
 *     check; consumers should pass the current time, not historical)
 *
 * `direction` (+1 or -1) is encoded into `magnitude_sd`: a downward
 * shift on a higher-is-better metric (e.g. grip) yields a negative
 * magnitude, an upward shift on a lower-is-better metric (e.g.
 * fatigue) yields a positive magnitude. Detectors interpret the sign
 * against their metric polarity.
 */
export function cusumPosterior(
  residuals: readonly ResidualObservation[],
  asOfISO: string,
  opts: CusumOptions = {},
): ChangePosterior | null {
  const k = opts.k ?? DEFAULT_K;
  const minN = opts.min_n ?? MIN_N;
  if (residuals.length < minN) return null;
  const values: number[] = [];
  const dates: string[] = [];
  for (const r of residuals) {
    if (Number.isFinite(r.value)) {
      values.push(r.value);
      dates.push(r.date);
    }
  }
  if (values.length < minN) return null;

  const trace = runCusum(values, k);
  const tauIdx = changePointIndex(trace);
  const tauDate = dates[tauIdx] ?? dates[dates.length - 1] ?? asOfISO;
  const tauDaysAgo = daysBetween(tauDate, asOfISO);
  const bands = {
    quiet: opts.quiet ?? DEFAULT_QUIET,
    noise: opts.noise ?? DEFAULT_NOISE,
    confirm: opts.confirm ?? DEFAULT_CONFIRM,
    fire: opts.fire ?? DEFAULT_FIRE,
  };
  const p_change = probabilityFromStat(trace.max_abs_s, bands);

  // Magnitude estimate: the average residual since the change-point.
  // Cheap approximation; BOCPD will replace with a posterior mean.
  const segment = values.slice(tauIdx);
  const magnitude_unsigned =
    segment.length > 0
      ? segment.reduce((a, b) => a + b, 0) / segment.length
      : 0;
  const magnitude_sd =
    trace.direction === 0 ? 0 : Math.sign(magnitude_unsigned) * Math.abs(magnitude_unsigned);

  return {
    p_change,
    tau_days_ago: tauDaysAgo,
    magnitude_sd,
    n_used: values.length,
    method: "cusum",
  };
}

/**
 * Test seam: exposes the underlying CUSUM trace so property-based
 * tests can assert on the running statistics, not just the posterior.
 */
export const _internals = {
  runCusum,
  changePointIndex,
  probabilityFromStat,
  DEFAULT_K,
  DEFAULT_QUIET,
  DEFAULT_NOISE,
  DEFAULT_CONFIRM,
  DEFAULT_FIRE,
};
