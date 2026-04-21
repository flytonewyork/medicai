// Slope / acceleration primitives — pure functions, no Dexie, no Date.now.
import { isoFromEpochDay, toEpochDays } from "~/lib/utils/date";
import type { Observation } from "./types";

/**
 * Returns observations whose `date` falls within the closed interval
 * [asOfISO - windowDays, asOfISO], inclusive. Tolerant of unsorted input.
 */
export function observationsInWindow(
  observations: readonly Observation[],
  asOfISO: string,
  windowDays: number,
): Observation[] {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return [];
  const minDay = asOfDay - windowDays;
  return observations.filter((o) => {
    const d = toEpochDays(o.date);
    return !Number.isNaN(d) && d >= minDay && d <= asOfDay;
  });
}

/**
 * Ordinary least squares slope of value over time (days). Returns null when
 * fewer than 3 observations are available or when all observations land on the
 * same day (variance of x is 0). Units: value-per-day.
 */
export function olsSlopePerDay(observations: readonly Observation[]): number | null {
  if (observations.length < 3) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const o of observations) {
    const d = toEpochDays(o.date);
    if (Number.isNaN(d) || !Number.isFinite(o.value)) continue;
    xs.push(d);
    ys.push(o.value);
  }
  if (xs.length < 3) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    num += dx * (ys[i]! - meanY);
    den += dx * dx;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Slope over the most recent `windowDays` ending at `asOfISO`.
 */
export function slopeOver(
  observations: readonly Observation[],
  asOfISO: string,
  windowDays: number,
): number | null {
  const scoped = observationsInWindow(observations, asOfISO, windowDays);
  return olsSlopePerDay(scoped);
}

/**
 * Acceleration: slope over the most recent `halfWindow` days minus slope over
 * the immediately prior `halfWindow` days. A negative number on a higher-is-
 * better metric indicates worsening drift; a positive number indicates
 * recovery. Units: value-per-day-per-fortnight when halfWindow=7.
 *
 * Returns null when either half window produces a null slope.
 */
export function accelOver(
  observations: readonly Observation[],
  asOfISO: string,
  halfWindow: number,
): number | null {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return null;
  const recent = observationsInWindow(observations, asOfISO, halfWindow);
  const priorEndDay = asOfDay - halfWindow;
  const priorEndISO = isoFromEpochDay(priorEndDay);
  const prior = observationsInWindow(observations, priorEndISO, halfWindow);
  const sRecent = olsSlopePerDay(recent);
  const sPrior = olsSlopePerDay(prior);
  if (sRecent == null || sPrior == null) return null;
  return sRecent - sPrior;
}
