// Patient-SD estimation. Every metric has patient-specific noise — resting
// step count varies 500 units for a sedentary patient and 3000 for an active
// one. Expressing "drift" in patient-SDs makes detection thresholds
// universal across metrics and across patients.
import type { Observation } from "./types";

function toEpochDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.floor(t / 86_400_000);
}

export interface VarianceEstimate {
  mean: number;
  sd: number;
  n: number;
  window_start?: string;
  window_end?: string;
}

/**
 * Sample standard deviation over a trailing window. Excludes the `asOf` day.
 * Returns null when the window has fewer than `minN` observations or the SD
 * collapses to zero (constant series — no useful noise estimate).
 *
 * Uses Bessel's correction (n-1) so small samples don't underestimate SD.
 */
export function patientSD(
  observations: readonly Observation[],
  asOfISO: string,
  windowDays: number,
  minN = 5,
): VarianceEstimate | null {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return null;
  const startDay = asOfDay - windowDays;
  const endDay = asOfDay - 1;
  const values: number[] = [];
  for (const o of observations) {
    const d = toEpochDays(o.date);
    if (Number.isNaN(d) || d < startDay || d > endDay) continue;
    if (!Number.isFinite(o.value)) continue;
    values.push(o.value);
  }
  if (values.length < minN) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqSum = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  const sd = Math.sqrt(sqSum / (values.length - 1));
  if (!Number.isFinite(sd) || sd === 0) return null;
  return {
    mean,
    sd,
    n: values.length,
    window_start: new Date(startDay * 86_400_000).toISOString().slice(0, 10),
    window_end: new Date(endDay * 86_400_000).toISOString().slice(0, 10),
  };
}

/**
 * Rolling mean over a trailing window ending at asOf (inclusive).
 * Used for "current level" comparison against a baseline mean.
 */
export function rollingMean(
  observations: readonly Observation[],
  asOfISO: string,
  windowDays: number,
  minN = 3,
): number | null {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return null;
  const startDay = asOfDay - windowDays + 1;
  const values: number[] = [];
  for (const o of observations) {
    const d = toEpochDays(o.date);
    if (Number.isNaN(d) || d < startDay || d > asOfDay) continue;
    if (!Number.isFinite(o.value)) continue;
    values.push(o.value);
  }
  if (values.length < minN) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * For how many consecutive days (counting back from asOf) has the rolling
 * mean remained below `threshold`? Returns 0 when today's rolling mean is
 * already above threshold. Used to quantify the duration component of a
 * drift signal.
 */
export function consecutiveDaysBelow(
  observations: readonly Observation[],
  asOfISO: string,
  rollingWindow: number,
  threshold: number,
  minN = 3,
  maxLookback = 21,
): number {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return 0;
  let days = 0;
  for (let back = 0; back < maxLookback; back++) {
    const checkISO = new Date((asOfDay - back) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const mean = rollingMean(observations, checkISO, rollingWindow, minN);
    if (mean == null) break;
    if (mean <= threshold) days++;
    else break;
  }
  return days;
}

/**
 * Mirror of `consecutiveDaysBelow` for the opposite direction — metrics where
 * rising values are the unhealthy direction (nausea, pain, LFTs).
 */
export function consecutiveDaysAbove(
  observations: readonly Observation[],
  asOfISO: string,
  rollingWindow: number,
  threshold: number,
  minN = 3,
  maxLookback = 21,
): number {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return 0;
  let days = 0;
  for (let back = 0; back < maxLookback; back++) {
    const checkISO = new Date((asOfDay - back) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const mean = rollingMean(observations, checkISO, rollingWindow, minN);
    if (mean == null) break;
    if (mean >= threshold) days++;
    else break;
  }
  return days;
}
