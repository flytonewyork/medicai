// Detector orchestration. `evaluateDetectors` runs the registered detector
// family against a state snapshot + observation series, and returns the
// emitted signals. Consumers diff those against persisted signals to decide
// what to write / resolve / suppress.
import type { ChangeSignal, Detector, DetectorContext } from "./types";
import { gripDeclineDetector } from "./grip-decline";
import { stepsDeclineDetector } from "./steps-decline";

export { stepsDeclineDetector } from "./steps-decline";
export { gripDeclineDetector } from "./grip-decline";
export {
  attributeSignal,
  eventsBySignalId,
  type AttributedAction,
  type AttributionConfidence,
  type SignalAttribution,
} from "./attribution";
export {
  logSignalEvent,
  getEventsForSignal,
  getAllSignalEvents,
  computeLoopSummary,
  type LogSignalEventInput,
  type SignalLoopSummary,
} from "./events";
export type {
  ChangeSignal,
  Detector,
  DetectorContext,
  DifferentialCause,
  DifferentialConfidence,
  SignalEvidence,
  SignalSeverity,
  SignalShape,
  SignalStatus,
  SuggestedAction,
  SuggestedActionKind,
  ActionUrgency,
} from "./types";
export {
  metricAtLeast,
  metricAtMost,
  metricDriftingAgainst,
  cycleDayBetween,
  rankDifferential,
  type CandidateCause,
  type CandidatePredicate,
} from "./differential";

export const DETECTORS: readonly Detector[] = [
  stepsDeclineDetector,
  gripDeclineDetector,
];

export function evaluateDetectors(
  ctx: DetectorContext,
  detectors: readonly Detector[] = DETECTORS,
): ChangeSignal[] {
  const signals: ChangeSignal[] = [];
  for (const d of detectors) {
    try {
      signals.push(...d.evaluate(ctx));
    } catch {
      // Detectors must never crash the evaluator — skip on error.
    }
  }
  return signals;
}

export interface SignalReconciliation {
  to_insert: ChangeSignal[];            // freshly emitted, not persisted yet
  to_resolve: string[];                 // fired_for keys whose drift recovered
}

/**
 * Reconcile newly-emitted signals against a persisted set.
 * - Signals already persisted with status open/acknowledged/dismissed are
 *   suppressed from `to_insert`.
 * - Persisted "open" signals whose underlying drift has recovered are
 *   returned in `to_resolve` so the caller can update their status.
 */
export function reconcileSignals(
  emitted: readonly ChangeSignal[],
  persisted: readonly { fired_for: string; status: string }[],
  ctx: DetectorContext,
  detectors: readonly Detector[] = DETECTORS,
): SignalReconciliation {
  const persistedByKey = new Map(
    persisted.map((p) => [p.fired_for, p.status]),
  );
  const to_insert: ChangeSignal[] = [];
  for (const e of emitted) {
    if (persistedByKey.has(e.fired_for)) continue;
    to_insert.push(e);
  }

  const to_resolve: string[] = [];
  for (const p of persisted) {
    if (p.status !== "open") continue;
    const detectorId = p.fired_for.split(":")[0];
    const detector = detectors.find((d) => d.id === detectorId);
    if (!detector) continue;
    // We reconstruct a minimal signal shape for hasResolved; detectors only
    // need the `detector` field in practice for routing.
    const stub = { detector: detectorId } as ChangeSignal;
    if (detector.hasResolved(stub, ctx)) {
      to_resolve.push(p.fired_for);
    }
  }

  return { to_insert, to_resolve };
}
