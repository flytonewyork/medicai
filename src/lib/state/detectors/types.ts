// Change-detector types. A detector watches one or more metrics in a
// PatientStateSnapshot and emits a ChangeSignal when a trend crosses a
// statistical threshold — *before* any hard zone-rule fires. Each signal
// carries the numeric evidence, a ranked differential of likely causes (each
// supported by concurrent metrics), and suggested actions the patient / carer
// / clinician can take.
import type { Axis, Observation, PatientStateSnapshot } from "../types";
import type { LocalizedText } from "~/types/treatment";

export type SignalSeverity = "caution" | "warning";

// How the signal manifests — pick one shape. Used by consumers to style
// output and by the resolution logic to decide when to auto-close.
export type SignalShape =
  | "rolling_drift"      // rolling mean drifted ≥ k·SD below/above baseline
  | "slope_flip"         // slope direction reversed over a window
  | "acceleration"       // slope is getting more extreme faster
  | "cycle_regression"   // this cycle worse than previous at matched day
  | "recovery_failure";  // expected rebound didn't happen

export interface SignalEvidence {
  baseline_value: number;
  baseline_kind: string;          // mirrors Baseline.kind for traceability
  current_value: number;
  delta_abs: number;
  // Drift expressed in patient-SDs — the unit that makes "subtle" quantifiable.
  // Negative = below baseline (for higher-better metrics this is the unhealthy
  // direction).
  sd_units: number;
  duration_days: number;          // how long the drift has been detectable
  // Optional slope trace; useful for UI sparklines and explanation.
  slope_recent?: number;
  slope_prior?: number;
}

export type DifferentialConfidence = "likely" | "possible" | "unlikely";

export interface DifferentialCause {
  id: string;                     // e.g. "chemo_recovery", "disease_progression"
  label: LocalizedText;
  confidence: DifferentialConfidence;
  // Metric ids whose current value supports this cause. UI shows these so the
  // reasoning is auditable, not a black box.
  supporting_metric_ids: string[];
  explanation?: LocalizedText;
}

export type SuggestedActionKind =
  // Route to a treatment lever entry (see config/treatment-levers.json).
  | "lever"
  // Create / surface a PatientTask from a preset.
  | "task"
  // Add a question to raise at the next clinic review.
  | "question"
  // Family / carer conversation prompt.
  | "conversation"
  // Self-care action the patient can take today.
  | "self";

export type ActionUrgency = "now" | "soon" | "next_visit";

export interface SuggestedAction {
  kind: SuggestedActionKind;
  // Reference id — for `lever` it's a treatment-lever id; for `task` it's a
  // task-preset id; for others it's a free-form identifier for the action.
  ref_id: string;
  label: LocalizedText;
  urgency: ActionUrgency;
  rationale?: LocalizedText;
}

// Status lifecycle of a persisted signal. Detectors emit "open" signals.
// The user can dismiss / acknowledge. The evaluator auto-resolves a signal
// when the underlying drift recovers.
export type SignalStatus =
  | "open"
  | "acknowledged"
  | "dismissed"
  | "resolved";

// Emitted by a detector. Consumers persist it in `change_signals` with the
// extra dexie fields (id, status, timestamps). `fired_for` is a dedupe key
// that identifies the logical occurrence — another evaluation of the same
// drift should produce the same `fired_for`.
export interface ChangeSignal {
  detector: string;                // detector id, e.g. "steps_decline"
  fired_for: string;               // dedupe key, e.g. "steps_decline:2026-W17"
  metric_id: string;               // primary metric
  axis: Axis;
  shape: SignalShape;
  severity: SignalSeverity;
  title: LocalizedText;
  explanation: LocalizedText;
  evidence: SignalEvidence;
  differential: DifferentialCause[];
  actions: SuggestedAction[];
}

export interface DetectorContext {
  state: PatientStateSnapshot;
  // Per-metric raw observation series, keyed by metric_id. Detectors that
  // need rolling-window or variance math over the raw series read from here
  // rather than re-deriving from dexie. Populated by the state module's
  // `extractObservationsByMetric()` helper.
  observations: Record<string, Observation[]>;
  now: string;                     // ISO, deterministic for tests
}

export interface Detector {
  id: string;
  // Pure function. Given the current state, returns 0 or more signals.
  // Idempotent: calling twice in the same context returns identical signals.
  evaluate(ctx: DetectorContext): ChangeSignal[];
  // Given a previously-emitted signal that is currently "open", return true
  // if the underlying condition has recovered and the signal can auto-resolve.
  hasResolved(signal: ChangeSignal, ctx: DetectorContext): boolean;
}
