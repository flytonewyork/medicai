// Public surface of the state module. Consumers should import from here,
// not from the internal files, so refactors inside the module stay free.
export type {
  Axis,
  AxisSummary,
  Baseline,
  BaselineKind,
  MetricDefinition,
  MetricPolarity,
  MetricTrajectory,
  Observation,
  PatientStateCycleContext,
  PatientStateSnapshot,
} from "./types";
export {
  METRIC_REGISTRY,
  METRICS_BY_ID,
  type RegisteredMetric,
} from "./metrics";
export {
  cycleMatchedBaseline,
  fixedBaseline,
  preCycleBaseline,
  preDiagnosisBaseline,
  preferredBaseline,
  rollingBaseline,
} from "./baselines";
export { accelOver, olsSlopePerDay, slopeOver } from "./slope";
export { buildPatientState, type BuildStateInputs } from "./build";
