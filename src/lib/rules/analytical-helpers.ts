// Phase 1 — analytical helpers used by V2 zone rules to ask
// cycle-aware questions about a metric. All three are pure compositions
// over `residualSeries` + `chronicResiduals` + the slope primitives in
// `src/lib/state/`. They take raw observations + cycles directly so
// they're trivially unit-testable and don't couple to ClinicalSnapshot.
//
// What problem they solve: today every rule in `zone-rules.ts` reads
// raw values against a single static baseline. A grip dip on cycle
// day 5 looks the same to those rules as a grip dip on cycle day 21,
// but only one of those is signal. CLAUDE.md design principle 5
// ("trends over points") demands rules that strip cycle variance
// before deciding "is this drift?"
//
// These helpers will be consumed by V2 zone rules (Phase 3). They
// don't change any V1 behaviour by themselves.
import {
  chronicResiduals,
  residualSeries,
  type CycleStub,
} from "~/lib/state/analytical";
import { observationsInWindow, olsSlopePerDay } from "~/lib/state";
import type { Observation } from "~/lib/state";

interface BaseArgs {
  metricId: string;
  observations: readonly Observation[];
  cycles: readonly CycleStub[];
  /**
   * Anchor date for windowing. Tests pass an explicit ISO; production
   * calls pass the engine's snapshot timestamp.
   */
  asOf: string;
}

/**
 * OLS slope of the chronic residual stream over the trailing window,
 * in residual-SD units per day. Negative on a higher-is-better metric
 * means the chronic component is drifting away from expected — exactly
 * the axis-3 toxicity signal we care about.
 *
 * Returns null when fewer than 3 observations land in the window
 * (matching `olsSlopePerDay`'s contract).
 */
export function chronicSlope(
  args: BaseArgs & { windowDays: number },
): number | null {
  const residuals = chronicResiduals(
    residualSeries({
      metric_id: args.metricId,
      observations: args.observations,
      cycles: args.cycles,
    }),
  );
  // ResidualObservation has `date` and `value` (residual in SD units),
  // which is the shape `observationsInWindow` + `olsSlopePerDay`
  // already accept.
  const inWindow = observationsInWindow(
    residuals.map((r) => ({ date: r.date, value: r.value })),
    args.asOf,
    args.windowDays,
  );
  return olsSlopePerDay(inWindow);
}

/**
 * True when the most recent `consecutiveDays` chronic residuals — by
 * date order, not array order — are all at or below `-sdBelow` SD
 * units. Acute-flagged observations are excluded by `chronicResiduals`
 * before consecutive counting; a one-day acute event doesn't reset
 * the run. False if fewer than `consecutiveDays` chronic residuals
 * exist on or before `asOf`.
 *
 * Captures the "metric has been below the expected band for a week"
 * pattern that single-point thresholds miss.
 */
export function residualBelowExpected(
  args: BaseArgs & { sdBelow: number; consecutiveDays: number },
): boolean {
  if (args.consecutiveDays <= 0) return false;
  const residuals = chronicResiduals(
    residualSeries({
      metric_id: args.metricId,
      observations: args.observations,
      cycles: args.cycles,
    }),
  );
  // Keep residuals on or before asOf; sort ascending by date so the
  // tail is the most-recent run.
  const asOfMs = Date.parse(args.asOf);
  if (Number.isNaN(asOfMs)) return false;
  const sorted = residuals
    .filter((r) => {
      const t = Date.parse(r.date);
      return !Number.isNaN(t) && t <= asOfMs;
    })
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (sorted.length < args.consecutiveDays) return false;
  const tail = sorted.slice(-args.consecutiveDays);
  return tail.every((r) => r.value <= -args.sdBelow);
}

/**
 * Mean of the chronic residual stream over the trailing window.
 * Negative = the patient has been running systematically below the
 * cycle-aware expected curve. Different from `chronicSlope`: this
 * answers "where is the chronic component sitting?"; slope answers
 * "is it moving?".
 *
 * Returns null when no chronic residuals fall in the window (so rules
 * can branch on "no data" vs. "running normal").
 */
export function chronicMeanResidual(
  args: BaseArgs & { windowDays: number },
): number | null {
  const residuals = chronicResiduals(
    residualSeries({
      metric_id: args.metricId,
      observations: args.observations,
      cycles: args.cycles,
    }),
  );
  const inWindow = observationsInWindow(
    residuals.map((r) => ({ date: r.date, value: r.value })),
    args.asOf,
    args.windowDays,
  );
  if (inWindow.length === 0) return null;
  const sum = inWindow.reduce((a, b) => a + b.value, 0);
  return sum / inWindow.length;
}
