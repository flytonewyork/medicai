// Patient state model — the shared abstraction every rule / nudge engine
// should consume (slice 1 adds the module; later slices migrate consumers).
//
// Axes map to the four-pillar clinical thesis: every metric is assigned to
// exactly one axis so axis-level scoring is well-defined. Signals that
// legitimately span axes (nausea, fatigue) are assigned to the most likely
// *driver* axis for the current patient context (mPDAC on chemo) — future
// work can support multi-axis contributions.

export type Axis = "individual" | "external" | "tumour" | "drug";

export type BaselineKind =
  // Captured at project setup from Settings.baseline_* fields. Static.
  | "pre_diagnosis"
  // Rolling arithmetic mean of the last N days of observations, excluding
  // today. Smooths short-term noise for trend comparisons.
  | "rolling_14d"
  | "rolling_28d"
  // Mean of the 7 days preceding the current treatment cycle's start_date.
  // The "what did this look like right before this cycle of chemo hit you"
  // reference. Undefined when no active cycle or insufficient prior data.
  | "pre_cycle"
  // Same cycle_day in the previous cycle (e.g. D8 of cycle 3 vs D8 of cycle 2).
  // The "is this cycle worse than the last one" reference for disruption
  // detection. Undefined when no prior cycle of the same protocol exists.
  | "cycle_matched"
  // Hard clinical reference (e.g. gait 1.2 m/s, ANC 1500).
  | "fixed";

export interface Baseline {
  kind: BaselineKind;
  value: number | null;
  // For windowed baselines: the observation window that produced `value`.
  window_start?: string;
  window_end?: string;
  // Number of observations contributing to this baseline's value.
  n?: number;
}

// Everything we compute per metric per snapshot. Consumers of this struct
// (zone rules, trend nudges, medication prompts, UI) never need to touch the
// raw Dexie rows.
export interface MetricTrajectory {
  metric_id: string;
  axis: Axis;
  // Latest observed value + when it was captured. null ⇒ no data yet.
  value: number | null;
  as_of?: string;
  // Baselines are sparse — only the ones we can compute are populated.
  baselines: Partial<Record<BaselineKind, Baseline>>;
  // Convenience deltas vs the most authoritative available baseline
  // (preference order: pre_diagnosis → pre_cycle → rolling_28d).
  // Units: `abs_from_baseline` in the metric's native unit; `pct_from_baseline`
  // in percent (positive = metric increased from baseline).
  abs_from_baseline?: number;
  pct_from_baseline?: number;
  baseline_used?: BaselineKind;
  // Ordinary least-squares slope fit over the trailing window. Units per day.
  // null when < 3 observations in window or insufficient time span.
  slope_7d?: number | null;
  slope_28d?: number | null;
  // Change in slope over the most recent fortnight: slope(last 7d) − slope(prior 7d).
  // A negative number on a "higher is better" metric means drift is accelerating.
  accel_14d?: number | null;
  // Number of observations the trajectory was computed from.
  sample_count: number;
  // True when `value` is fresher than the metric's expected cadence (e.g.
  // daily metric with value from today, or labs metric with value within 28d).
  // Consumers use this to suppress "no data" signals vs. "real but concerning".
  fresh: boolean;
}

export type MetricPolarity = "higher_better" | "lower_better" | "neutral";

export interface MetricDefinition {
  id: string;
  axis: Axis;
  // Direction of "health" for this metric — informs zone derivation and
  // encouragement framing. `neutral` for metrics where direction doesn't
  // translate directly to outcome (e.g. body temperature, steps goal can be
  // over or under).
  polarity: MetricPolarity;
  // Expected observation cadence in days. Used by `fresh` computation and by
  // the snapshot's "missing recent data" signal.
  cadence_days: number;
  // Human-readable label for debugging / future UI. Bilingual copy lives in
  // individual surfaces, not the state model.
  label: string;
  // Unit string for tooltips / debugging.
  unit?: string;
}

export interface AxisSummary {
  axis: Axis;
  // Aggregate axis score 0-100, higher = better. Computed as a recency-weighted
  // mean of normalised per-metric scores. Undefined when no metrics have data.
  score?: number;
  // Count of metrics in this axis that have at least one observation.
  n_metrics_observed: number;
  // Count of registered metrics in this axis (observed or not).
  n_metrics_total: number;
  // Metric ids whose trajectory is drifting in the unhealthy direction by
  // ≥ 1 standard deviation from its pre-diagnosis or rolling baseline.
  disrupted_metric_ids: string[];
}

export interface PatientStateCycleContext {
  cycle_id?: number;
  cycle_number: number;
  protocol_id: string;
  start_date: string;
  cycle_day: number;
  cycle_length_days: number;
}

export interface PatientStateSnapshot {
  // ISO timestamp for the snapshot (deterministic input, not `new Date()`
  // at build time, so tests and replays are stable).
  as_of: string;
  // Active or most recently active cycle context, null if none.
  cycle: PatientStateCycleContext | null;
  // Every registered metric appears here (even if value is null) so consumers
  // can branch on "metric exists / no data" vs. "metric unobserved ever".
  metrics: Record<string, MetricTrajectory>;
  // One summary per axis, regardless of whether any metrics reported data.
  axes: Record<Axis, AxisSummary>;
}

// Observation point used internally by baseline / slope primitives.
// Kept small and numeric so downstream code can generically operate on it.
export interface Observation {
  date: string; // ISO date (YYYY-MM-DD) or ISO datetime
  value: number;
}
