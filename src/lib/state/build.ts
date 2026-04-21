// Build a PatientStateSnapshot from raw Dexie-sourced data.
//
// Pure function. Takes raw data + an `as_of` ISO for deterministic tests.
// Everything consumers need to reason about the patient's current state
// across all four axes comes out of this function.
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  Settings,
} from "~/types/clinical";
import type { TreatmentCycle } from "~/types/treatment";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { MS_PER_DAY, toEpochDays } from "~/lib/utils/date";
import { METRIC_REGISTRY } from "./metrics";
import {
  cycleMatchedBaseline,
  preCycleBaseline,
  preDiagnosisBaseline,
  preferredBaseline,
  rollingBaseline,
} from "./baselines";
import { accelOver, slopeOver } from "./slope";
import type { RegisteredMetric } from "./metrics";
import type {
  Axis,
  AxisSummary,
  Baseline,
  MetricTrajectory,
  Observation,
  PatientStateCycleContext,
  PatientStateSnapshot,
} from "./types";

export interface BuildStateInputs {
  as_of: string;                          // ISO timestamp (may be any ISO)
  settings: Settings | null;
  dailies: readonly DailyEntry[];         // any order; builder sorts internally
  fortnightlies: readonly FortnightlyAssessment[];
  labs: readonly LabResult[];
  cycles: readonly TreatmentCycle[];
}

// Map metric_id → static pre-diagnosis scalar from Settings.
// Only metrics that have a meaningful pre-diagnosis baseline are listed.
function preDiagnosisFromSettings(
  settings: Settings | null,
): Record<string, { value: number | undefined; date?: string }> {
  if (!settings) return {};
  return {
    weight_kg: {
      value: settings.baseline_weight_kg,
      date: settings.baseline_date,
    },
    grip_dominant_kg: {
      value: settings.baseline_grip_dominant_kg,
      date: settings.baseline_date,
    },
    gait_speed_ms: {
      value: settings.baseline_gait_speed_ms,
      date: settings.baseline_date,
    },
  };
}

function resolveActiveCycle(
  cycles: readonly TreatmentCycle[],
  asOfISO: string,
): PatientStateCycleContext | null {
  const asOf = Date.parse(asOfISO);
  if (Number.isNaN(asOf)) return null;
  const candidate = cycles
    .filter((c) => c.status === "active" || c.status === "planned")
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.start_date) - Date.parse(a.start_date),
    )[0];
  if (!candidate) return null;
  const protocol =
    candidate.protocol_id === "custom" && candidate.custom_protocol
      ? candidate.custom_protocol
      : PROTOCOL_BY_ID[candidate.protocol_id];
  const startMs = Date.parse(candidate.start_date);
  if (Number.isNaN(startMs)) return null;
  const cycleDay = Math.floor((asOf - startMs) / MS_PER_DAY) + 1;
  return {
    cycle_id: candidate.id,
    cycle_number: candidate.cycle_number,
    protocol_id: candidate.protocol_id,
    start_date: candidate.start_date,
    cycle_day: cycleDay,
    cycle_length_days: protocol?.cycle_length_days ?? 28,
  };
}

function priorSameProtocolCycleStart(
  cycles: readonly TreatmentCycle[],
  current: PatientStateCycleContext | null,
): string | null {
  if (!current) return null;
  const currentStart = Date.parse(current.start_date);
  const prior = cycles
    .filter(
      (c) =>
        c.protocol_id === current.protocol_id &&
        Date.parse(c.start_date) < currentStart,
    )
    .sort(
      (a, b) => Date.parse(b.start_date) - Date.parse(a.start_date),
    )[0];
  return prior?.start_date ?? null;
}

function extractObservations(
  metric: RegisteredMetric,
  inputs: BuildStateInputs,
): Observation[] {
  const out: Observation[] = [];
  if (metric.fromDailies) {
    out.push(...metric.fromDailies(inputs.dailies));
  }
  if (metric.fromFortnightlies) {
    out.push(...metric.fromFortnightlies(inputs.fortnightlies));
  }
  if (metric.fromLabs) {
    out.push(...metric.fromLabs(inputs.labs));
  }
  // Sort ascending by date so downstream helpers can trust ordering.
  out.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return out;
}

function computeTrajectory(
  metric: RegisteredMetric,
  inputs: BuildStateInputs,
  cycle: PatientStateCycleContext | null,
  priorCycleStart: string | null,
  preDiagnosisSource: ReturnType<typeof preDiagnosisFromSettings>,
): MetricTrajectory {
  const obs = extractObservations(metric, inputs);
  const latest = obs[obs.length - 1];
  const baselines: Partial<Record<Baseline["kind"], Baseline>> = {};

  const preDx = preDiagnosisSource[metric.id];
  if (preDx && typeof preDx.value === "number") {
    const b = preDiagnosisBaseline(preDx.value, preDx.date);
    if (b) baselines.pre_diagnosis = b;
  }

  const r14 = rollingBaseline(obs, inputs.as_of, 14);
  if (r14) baselines.rolling_14d = r14;
  const r28 = rollingBaseline(obs, inputs.as_of, 28);
  if (r28) baselines.rolling_28d = r28;

  if (cycle) {
    const pc = preCycleBaseline(obs, cycle.start_date);
    if (pc) baselines.pre_cycle = pc;
    if (priorCycleStart) {
      const cm = cycleMatchedBaseline(obs, priorCycleStart, cycle.cycle_day);
      if (cm) baselines.cycle_matched = cm;
    }
  }

  const preferred = preferredBaseline(baselines);
  const latestValue = latest?.value ?? null;
  let abs_from_baseline: number | undefined;
  let pct_from_baseline: number | undefined;
  let baseline_used: Baseline["kind"] | undefined;
  if (preferred && typeof latestValue === "number" && preferred.value !== null) {
    baseline_used = preferred.kind;
    abs_from_baseline = latestValue - preferred.value;
    pct_from_baseline =
      preferred.value !== 0
        ? ((latestValue - preferred.value) / preferred.value) * 100
        : undefined;
  }

  const slope_7d = slopeOver(obs, inputs.as_of, 7);
  const slope_28d = slopeOver(obs, inputs.as_of, 28);
  const accel_14d = accelOver(obs, inputs.as_of, 7);

  const fresh = (() => {
    if (!latest) return false;
    const asOfDay = toEpochDays(inputs.as_of);
    const latestDay = toEpochDays(latest.date);
    if (Number.isNaN(asOfDay) || Number.isNaN(latestDay)) return false;
    return asOfDay - latestDay <= metric.cadence_days * 2;
  })();

  return {
    metric_id: metric.id,
    axis: metric.axis,
    value: latestValue,
    as_of: latest?.date,
    baselines,
    baseline_used,
    abs_from_baseline,
    pct_from_baseline,
    slope_7d,
    slope_28d,
    accel_14d,
    sample_count: obs.length,
    fresh,
  };
}

function disruptedFor(
  trajectory: MetricTrajectory,
  polarity: RegisteredMetric["polarity"],
): boolean {
  const pct = trajectory.pct_from_baseline;
  if (typeof pct !== "number" || !trajectory.fresh) return false;
  // Threshold ≈ 15% off baseline — "clinically meaningful drift" in the
  // absence of per-metric calibration. Will be replaced in slice 2 with
  // per-metric disruption thresholds derived from the metric's own variance
  // (roughly 1 SD). For polarity=neutral we don't call out disruption.
  if (polarity === "higher_better") return pct <= -15;
  if (polarity === "lower_better") return pct >= 15;
  return false;
}

function axisScoreFor(
  trajectories: MetricTrajectory[],
  registry: readonly RegisteredMetric[],
): number | undefined {
  // Normalise each metric's delta-from-baseline into a 0-100 score where
  // 100 = on or above baseline (higher_better) / on or below baseline
  // (lower_better), and 0 = 30% off baseline in the unhealthy direction.
  // Average across metrics that have data and a usable baseline. Metrics
  // without baseline or fresh data are ignored. Undefined if none contribute.
  const contributions: number[] = [];
  for (const t of trajectories) {
    if (!t.fresh || typeof t.pct_from_baseline !== "number") continue;
    const def = registry.find((m) => m.id === t.metric_id);
    if (!def) continue;
    const pct = t.pct_from_baseline;
    let raw = 100;
    if (def.polarity === "higher_better") {
      raw = 100 + (pct / 30) * 100; // -30% => 0, 0% => 100
    } else if (def.polarity === "lower_better") {
      raw = 100 - (pct / 30) * 100; // +30% => 0, 0% => 100
    }
    contributions.push(Math.max(0, Math.min(100, raw)));
  }
  if (contributions.length === 0) return undefined;
  const mean =
    contributions.reduce((a, b) => a + b, 0) / contributions.length;
  return Math.round(mean);
}

export function buildPatientState(
  inputs: BuildStateInputs,
): PatientStateSnapshot {
  const cycle = resolveActiveCycle(inputs.cycles, inputs.as_of);
  const priorCycleStart = priorSameProtocolCycleStart(inputs.cycles, cycle);
  const preDiagnosisSource = preDiagnosisFromSettings(inputs.settings);

  const metrics: Record<string, MetricTrajectory> = {};
  for (const m of METRIC_REGISTRY) {
    metrics[m.id] = computeTrajectory(
      m,
      inputs,
      cycle,
      priorCycleStart,
      preDiagnosisSource,
    );
  }

  const axes: Record<Axis, AxisSummary> = {
    individual: buildAxisSummary("individual", metrics),
    external: buildAxisSummary("external", metrics),
    tumour: buildAxisSummary("tumour", metrics),
    drug: buildAxisSummary("drug", metrics),
  };

  return { as_of: inputs.as_of, cycle, metrics, axes };
}

function buildAxisSummary(
  axis: Axis,
  metrics: Record<string, MetricTrajectory>,
): AxisSummary {
  const registered = METRIC_REGISTRY.filter((m) => m.axis === axis);
  const trajectories = registered.map((m) => metrics[m.id]!);
  const observed = trajectories.filter((t) => t.sample_count > 0);
  const disrupted_metric_ids: string[] = [];
  for (const t of trajectories) {
    const def = registered.find((m) => m.id === t.metric_id);
    if (!def) continue;
    if (disruptedFor(t, def.polarity)) disrupted_metric_ids.push(t.metric_id);
  }
  const score = axisScoreFor(trajectories, registered);
  return {
    axis,
    score,
    n_metrics_observed: observed.length,
    n_metrics_total: registered.length,
    disrupted_metric_ids,
  };
}
