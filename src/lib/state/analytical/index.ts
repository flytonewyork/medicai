// Public surface of the analytical layer. Consumers (detectors,
// formatters, the future clinic-brief composer) should import from
// here, never from individual modules — that lets us refactor the
// internals without touching call sites.
export {
  validateCycleCurves,
  expectedAt,
  expectedAtCycle,
  detectorGuards,
  patientOverride,
  regimen,
  _resetCycleCurvesCache,
  type CycleCurvesFile,
  type MetricBlock,
} from "./cycle-curves";

export {
  expectedFor,
  expectedForCycle,
  shrinkPersonalToPopulation,
  type PersonalCycleFit,
} from "./cycle-model";

export {
  residualSeries,
  chronicResiduals,
  cycleDayFor,
  type CycleStub,
  type DetrendArgs,
} from "./detrend";

export {
  detectAcute,
  acuteExcludedDates,
  type AcuteContext,
} from "./red-flag";

export {
  cusumPosterior,
  type CusumOptions,
} from "./changepoint";

export type {
  AcuteFlag,
  AcuteKind,
  AnalyticalContext,
  AnalyticalSource,
  ChangePosterior,
  ElicitationKind,
  ElicitationRequest,
  ExpectedPoint,
  ResidualObservation,
} from "./types";
