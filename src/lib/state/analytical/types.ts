// Analytical-layer types — the contract between cycle-detrending,
// change-point detection, the acute-flag bypass, and the existing
// detector layer. Kept intentionally narrow so the analytical layer
// can evolve (CUSUM → BOCPD, population-only → personal-blended)
// without churning the consumer code.
import type { Axis, Observation } from "../types";
import type { LocalizedText } from "~/types/treatment";

// Where a residual's expected mean / SD came from. Population priors
// dominate early; once 4-6 weeks of clean data exist a personal SD is
// computed and shrunk against the population estimate; once 3+ cycles
// are recorded the per-day mean curve is also blended.
export type AnalyticalSource = "population" | "personal" | "blended";

// One point on an expected curve. `n_effective` carries forward from
// cycle-curves.json so the detrend layer can size its prior weight
// without re-reading config.
export interface ExpectedPoint {
  mean: number;
  sd: number;
  n_effective: number;
  source: AnalyticalSource;
}

// An observation after cycle-detrending. `value` is the residual in
// expected-SD units — the unit that makes "subtle" comparable across
// metrics and cycle phases. Raw + expected are kept on the row so
// rendering layers (the clinician dual-view overlay) can reproduce
// the source data without a separate query.
export interface ResidualObservation {
  date: string;
  raw_value: number;
  expected_mean: number;
  expected_sd: number;
  value: number;            // residual in SD units; (raw - mean) / sd
  source: AnalyticalSource;
  // True when the underlying observation triggered an acute flag and
  // was held out of the residual stream so the chronic detectors
  // don't misinterpret an acute event as a slow drift. Consumers
  // should still be able to see the point — the flag just marks it.
  excluded_acute?: boolean;
}

// Posterior over "did the data-generating process change recently?"
// Output shape is fixed across CUSUM (v1) and BOCPD (v2); only the
// `method` tag distinguishes them so consumers can route on it if
// they ever need to. `magnitude_sd` is the estimated shift in
// residual-SD units; `tau_days_ago` is when the change is best
// estimated to have happened.
export interface ChangePosterior {
  p_change: number;          // 0..1
  tau_days_ago: number;      // best estimate of onset
  magnitude_sd: number;      // size of the shift in SD units
  n_used: number;            // how many observations went into the fit
  method: "cusum" | "bocpd";
}

// The acute-flag taxonomy. These are events where (a) the chronic-
// drift pipeline would mis-attribute, and (b) the clinical team
// already covers the response — so the platform's job is to gate the
// data, surface ONE protocolised action, and stay quiet. Adding a new
// kind here requires a corresponding rule in red-flag.ts and a
// protocol-action localised string.
export type AcuteKind =
  | "fever"
  | "fn_suspected"           // fever within nadir window — call unit, do not stack
  | "pain_spike"             // delta >3 on 0-10 vs prior day
  | "jaundice"               // patient flag or bilirubin acute rise
  | "dyspnoea"               // patient flag
  | "bleeding"               // unexplained bruising / bleeding flag
  | "neuro_emergency";       // sudden focal weakness, severe headache, etc.

export interface AcuteFlag {
  kind: AcuteKind;
  // Identifier of the observation that triggered the flag. May be a
  // composite string (e.g. "daily:2026-04-12:temperature") since not
  // every source row has a numeric id; consumers treat it opaquely.
  observation_ref: string;
  // The single protocolised action the patient sees on the unified
  // feed. Calm, single-line, no probability — exactly one item.
  protocol_action: LocalizedText;
  // True for every acute flag — included on the type so consumers
  // pattern-match cleanly without remembering the rule.
  excluded_from_residual: true;
  // Auto-mute window: detector should not re-emit the same kind for
  // 24h after the flag is acknowledged.
  cleared_at?: string;
}

// What the elicitation engine asks for when a provisional needs a
// corroborating reading. Patient sees `prompt` only — never the kind,
// the posterior, or the detector id.
export type ElicitationKind =
  | "grip"
  | "sit_to_stand"
  | "gait_short"
  | "weight"
  | "sleep_recall"
  | "step_test_1min"
  | "mood_one_word";

export interface ElicitationRequest {
  kind: ElicitationKind;
  prompt: LocalizedText;     // single calm sentence, no urgency cues
  expires_at: string;        // 72h from creation
}

// Convenience surface used by the analytical layer's pure functions.
// The detector evaluator assembles one of these and passes it down;
// nobody else needs to construct it directly.
export interface AnalyticalContext {
  now: string;               // deterministic ISO for tests
  metric_id: string;
  axis: Axis;
  // Raw observations (not residuals) — detrend.ts is the boundary that
  // converts raw → residual. Acute filter runs before detrend.
  raw_observations: readonly Observation[];
  // Cycle context, when one is active. Population priors require this
  // to look up `expected_mean` / `expected_sd` per cycle_day.
  protocol_id?: string;
  cycle_day?: number;
  cycle_number?: number;
}
