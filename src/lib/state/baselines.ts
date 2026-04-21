// Baseline computation primitives.
//
// A "baseline" is a reference value the current metric value is compared
// against. Different kinds serve different purposes:
//
// - pre_diagnosis: the patient's steady state before cancer; from Settings.
// - rolling_14d / rolling_28d: short-term smoothed reference for slope work.
// - pre_cycle: the week leading into the current chemo cycle — the right
//   reference for "what did chemo disrupt from".
// - cycle_matched: same cycle day of the previous cycle — the right reference
//   for "is this cycle worse than the last one".
// - fixed: a hard clinical constant.
import type { Baseline, Observation } from "./types";

function toEpochDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.floor(t / 86_400_000);
}

function isoFromEpochDay(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function meanOf(observations: readonly Observation[]): number | null {
  const valid = observations
    .map((o) => o.value)
    .filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Rolling mean of observations falling in [asOf - windowDays, asOf - 1].
 * Excludes the `asOf` day itself so the baseline is a true reference point
 * separate from "today's value". Returns null when fewer than minN
 * observations fall in the window.
 */
export function rollingBaseline(
  observations: readonly Observation[],
  asOfISO: string,
  windowDays: number,
  minN = 3,
): Baseline | null {
  const asOfDay = toEpochDays(asOfISO);
  if (Number.isNaN(asOfDay)) return null;
  const startDay = asOfDay - windowDays;
  const endDay = asOfDay - 1;
  const scoped = observations.filter((o) => {
    const d = toEpochDays(o.date);
    return !Number.isNaN(d) && d >= startDay && d <= endDay;
  });
  if (scoped.length < minN) return null;
  const value = meanOf(scoped);
  if (value == null) return null;
  return {
    kind: windowDays === 14 ? "rolling_14d" : "rolling_28d",
    value,
    window_start: isoFromEpochDay(startDay),
    window_end: isoFromEpochDay(endDay),
    n: scoped.length,
  };
}

/**
 * Mean of observations in the 7 days preceding the cycle start date.
 * Returns null when the current cycle has no prior data, or when minN isn't
 * met. This captures the patient's "entering this cycle" reference.
 */
export function preCycleBaseline(
  observations: readonly Observation[],
  cycleStartISO: string,
  lookbackDays = 7,
  minN = 3,
): Baseline | null {
  const startDay = toEpochDays(cycleStartISO);
  if (Number.isNaN(startDay)) return null;
  const fromDay = startDay - lookbackDays;
  const toDay = startDay - 1;
  const scoped = observations.filter((o) => {
    const d = toEpochDays(o.date);
    return !Number.isNaN(d) && d >= fromDay && d <= toDay;
  });
  if (scoped.length < minN) return null;
  const value = meanOf(scoped);
  if (value == null) return null;
  return {
    kind: "pre_cycle",
    value,
    window_start: isoFromEpochDay(fromDay),
    window_end: isoFromEpochDay(toDay),
    n: scoped.length,
  };
}

/**
 * Cycle-matched baseline: the value (or narrow window around it) observed on
 * the same cycle day of the previous cycle. Takes the mean of a ±1-day window
 * around that day to smooth single-day gaps. Returns null when the prior
 * cycle wasn't long enough, no prior cycle exists, or no data lands in the
 * window.
 */
export function cycleMatchedBaseline(
  observations: readonly Observation[],
  priorCycleStartISO: string | null,
  currentCycleDay: number,
  tolerance = 1,
): Baseline | null {
  if (!priorCycleStartISO) return null;
  const priorStartDay = toEpochDays(priorCycleStartISO);
  if (Number.isNaN(priorStartDay)) return null;
  const targetDay = priorStartDay + currentCycleDay - 1;
  const fromDay = targetDay - tolerance;
  const toDay = targetDay + tolerance;
  const scoped = observations.filter((o) => {
    const d = toEpochDays(o.date);
    return !Number.isNaN(d) && d >= fromDay && d <= toDay;
  });
  if (scoped.length === 0) return null;
  const value = meanOf(scoped);
  if (value == null) return null;
  return {
    kind: "cycle_matched",
    value,
    window_start: isoFromEpochDay(fromDay),
    window_end: isoFromEpochDay(toDay),
    n: scoped.length,
  };
}

/**
 * Wrap a static scalar (e.g. Settings.baseline_weight_kg) as a Baseline.
 * Returns null when the input is not a finite number.
 */
export function preDiagnosisBaseline(
  value: number | null | undefined,
  baselineDateISO?: string,
): Baseline | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return {
    kind: "pre_diagnosis",
    value,
    window_start: baselineDateISO,
    window_end: baselineDateISO,
    n: 1,
  };
}

/**
 * Wrap a hard clinical reference constant.
 */
export function fixedBaseline(value: number): Baseline {
  return { kind: "fixed", value, n: 1 };
}

/**
 * Select the most authoritative baseline for delta computation.
 * Preference: pre_diagnosis → pre_cycle → rolling_28d → rolling_14d → fixed.
 * This order reflects "most specific to patient's own history first".
 */
export function preferredBaseline(
  baselines: Partial<Record<Baseline["kind"], Baseline>>,
): Baseline | null {
  const order: Baseline["kind"][] = [
    "pre_diagnosis",
    "pre_cycle",
    "rolling_28d",
    "rolling_14d",
    "fixed",
  ];
  for (const k of order) {
    const b = baselines[k];
    if (b && typeof b.value === "number") return b;
  }
  return null;
}
