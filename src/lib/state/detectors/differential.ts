// Differential-diagnosis helper. Given a primary signal and the current
// state snapshot, walks a list of candidate causes with evidence predicates
// and returns a ranked differential. Each cause carries a list of supporting
// metric_ids so the reasoning is auditable downstream.
import type { MetricTrajectory, PatientStateSnapshot } from "../types";
import type {
  DifferentialCause,
  DifferentialConfidence,
} from "./types";
import type { LocalizedText } from "~/types/treatment";

export interface CandidateCause {
  id: string;
  label: LocalizedText;
  explanation?: LocalizedText;
  // Each predicate inspects the state and either returns a supporting metric
  // id (contributes toward the cause) or null (no evidence). The number of
  // supporting metrics determines the confidence ranking.
  predicates: CandidatePredicate[];
  // If `required_supporters` of predicates don't match, the cause is downgraded
  // to "unlikely" regardless of how many other predicates match.
  required_supporters?: number;
}

export type CandidatePredicate = (
  state: PatientStateSnapshot,
) => string | null;

function confidenceFromSupporterCount(
  matched: number,
  totalPredicates: number,
  required = 0,
): DifferentialConfidence {
  if (matched === 0) return "unlikely";
  if (required > 0 && matched < required) return "unlikely";
  const ratio = matched / totalPredicates;
  if (ratio >= 0.66 || matched >= 3) return "likely";
  if (ratio >= 0.33 || matched >= 1) return "possible";
  return "unlikely";
}

export function rankDifferential(
  state: PatientStateSnapshot,
  candidates: readonly CandidateCause[],
): DifferentialCause[] {
  const out: DifferentialCause[] = [];
  for (const cand of candidates) {
    const supporters: string[] = [];
    for (const p of cand.predicates) {
      const m = p(state);
      if (m) supporters.push(m);
    }
    const confidence = confidenceFromSupporterCount(
      supporters.length,
      cand.predicates.length,
      cand.required_supporters,
    );
    out.push({
      id: cand.id,
      label: cand.label,
      confidence,
      supporting_metric_ids: supporters,
      explanation: cand.explanation,
    });
  }
  // Rank: likely > possible > unlikely; ties broken by more supporters.
  const rank = (c: DifferentialCause) =>
    c.confidence === "likely" ? 2 : c.confidence === "possible" ? 1 : 0;
  out.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      b.supporting_metric_ids.length - a.supporting_metric_ids.length,
  );
  return out;
}

// ─── Common predicates — shared building blocks for cause evidence ─────────
//
// Each returns `(state) => metric_id | null`. Consumers compose them per
// candidate cause. Keep these small and obvious — they are the audit trail.

/**
 * The named metric is drifting in the specified direction by at least
 * `minPctFromBaseline` percent off its preferred baseline. The caller knows
 * the metric's polarity; the predicate accepts `direction` explicitly so the
 * call site is unambiguous (e.g. for nausea, `direction: "higher"`).
 */
export function metricDriftingAgainst(
  metricId: string,
  direction: "lower" | "higher",
  minPctFromBaseline = 10,
): CandidatePredicate {
  return (state) => {
    const t: MetricTrajectory | undefined = state.metrics[metricId];
    if (!t || !t.fresh || typeof t.pct_from_baseline !== "number") return null;
    const pct = t.pct_from_baseline;
    const triggered =
      direction === "lower" ? pct <= -minPctFromBaseline : pct >= minPctFromBaseline;
    return triggered ? metricId : null;
  };
}

/**
 * The named metric's latest value is at or beyond the threshold.
 */
export function metricAtLeast(
  metricId: string,
  threshold: number,
): CandidatePredicate {
  return (state) => {
    const t = state.metrics[metricId];
    if (!t || !t.fresh || typeof t.value !== "number") return null;
    return t.value >= threshold ? metricId : null;
  };
}

export function metricAtMost(
  metricId: string,
  threshold: number,
): CandidatePredicate {
  return (state) => {
    const t = state.metrics[metricId];
    if (!t || !t.fresh || typeof t.value !== "number") return null;
    return t.value <= threshold ? metricId : null;
  };
}

/**
 * Cycle_day falls within [from, to] of the current cycle, inclusive.
 * Evidence predicate only — returns a synthetic "cycle_day" identifier.
 */
export function cycleDayBetween(from: number, to: number): CandidatePredicate {
  return (state) => {
    const d = state.cycle?.cycle_day;
    if (typeof d !== "number") return null;
    return d >= from && d <= to ? "cycle_day" : null;
  };
}
