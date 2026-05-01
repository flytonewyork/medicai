// Cycle-detrending — converts raw observations into residuals expressed
// in expected-SD units, using the population prior (and any personal
// fit) for the active treatment cycle.
//
// The detrend layer is the boundary that makes downstream change-point
// detection meaningful. A 7/10 fatigue rating on day-3 of a chemo
// cycle is unremarkable; the same rating on day-14 is a signal.
// CUSUM / BOCPD running on raw values cannot tell those apart.
// Running on residuals can.
//
// This module is pure — no Dexie, no Date.now. The cycle history is
// passed in as a typed array so unit tests can drive synthetic cases
// deterministically.
import type { Observation } from "../types";
import { expectedFor, type PersonalCycleFit } from "./cycle-model";
import type { ResidualObservation } from "./types";

// Minimal cycle shape detrend needs. Compatible with TreatmentCycle
// (extra fields ignored) but typed narrowly so tests can construct
// stubs without the full Dexie row. cycle_length_days defaults to 28
// (GnP-MPACT) when omitted; future non-28 protocols must populate it.
export interface CycleStub {
  start_date: string;
  cycle_number: number;
  cycle_length_days?: number;
}

function toEpochDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.floor(t / 86_400_000);
}

/**
 * Given a sorted-by-start_date list of cycles and an ISO date, return
 * the cycle that was active on that date together with the cycle_day
 * (1-based). Returns null when the date falls outside any recorded
 * cycle. Cycles are assumed non-overlapping — the platform's domain
 * rule. Default cycle length is 28 (GnP-MPACT).
 */
export function cycleDayFor(
  date: string,
  cycles: readonly CycleStub[],
): { cycle: CycleStub; cycle_day: number; cycle_number: number } | null {
  const day = toEpochDays(date);
  if (Number.isNaN(day)) return null;
  for (const cycle of cycles) {
    const start = toEpochDays(cycle.start_date);
    if (Number.isNaN(start)) continue;
    const length = cycle.cycle_length_days ?? 28;
    const end = start + length - 1;
    if (day >= start && day <= end) {
      return {
        cycle,
        cycle_day: day - start + 1,
        cycle_number: cycle.cycle_number,
      };
    }
  }
  return null;
}

export interface DetrendArgs {
  metric_id: string;
  observations: readonly Observation[];
  cycles: readonly CycleStub[];
  personal_fit?: PersonalCycleFit | null;
  /**
   * Set of observation refs (by date) that should be marked as
   * `excluded_acute` — produced upstream by the red-flag filter. The
   * residuals for these observations are still emitted (so the dual-
   * view overlay can render them) but downstream change-point
   * consumers should skip them.
   */
  acute_excluded_dates?: ReadonlySet<string>;
}

/**
 * Convert raw observations into residuals against the cycle-aware
 * expected curve. Order-preserving — each input observation produces
 * exactly one residual observation, in the same order. Observations
 * for which no expected curve exists (no active cycle, or metric not
 * in the population priors) emit a residual of value=0 with
 * expected_sd=1, source="population", which CUSUM treats as a
 * pass-through. This keeps the residual stream contiguous so
 * change-point posteriors don't fragment.
 */
export function residualSeries(args: DetrendArgs): ResidualObservation[] {
  const {
    metric_id,
    observations,
    cycles,
    personal_fit,
    acute_excluded_dates,
  } = args;
  const out: ResidualObservation[] = [];
  for (const obs of observations) {
    const ctx = cycleDayFor(obs.date, cycles);
    const expected = ctx
      ? expectedFor({
          metric_id,
          cycle_day: ctx.cycle_day,
          personal_fit,
        })
      : null;
    const excluded = acute_excluded_dates?.has(obs.date) ?? false;
    if (!expected) {
      // No cycle / no curve — emit a pass-through residual. The raw
      // value sits on the row so the clinician overlay still has the
      // datum; the residual itself is 0 against an SD of 1 so CUSUM
      // does not move.
      out.push({
        date: obs.date,
        raw_value: obs.value,
        expected_mean: obs.value,
        expected_sd: 1,
        value: 0,
        source: "population",
        excluded_acute: excluded || undefined,
      });
      continue;
    }
    const residual = (obs.value - expected.mean) / expected.sd;
    out.push({
      date: obs.date,
      raw_value: obs.value,
      expected_mean: expected.mean,
      expected_sd: expected.sd,
      value: residual,
      source: expected.source,
      excluded_acute: excluded || undefined,
    });
  }
  return out;
}

/**
 * Convenience filter — returns only the residuals safe to feed into a
 * change-point detector. Drops anything excluded by the acute filter.
 */
export function chronicResiduals(
  residuals: readonly ResidualObservation[],
): ResidualObservation[] {
  return residuals.filter((r) => !r.excluded_acute);
}
