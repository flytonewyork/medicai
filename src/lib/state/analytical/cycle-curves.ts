// Loader + lookup for the population-prior cycle curves.
//
// `cycle-curves.json` is hand-edited literature data; a runtime Zod
// schema check at module load catches typos that would otherwise
// silently corrupt residuals. The loader runs once at import time and
// caches the parsed config — `expectedAt()` / `varianceFor()` are
// pure lookups against that cache.
//
// The schema is intentionally permissive at the metric-block level
// because every metric has slightly different shape (some carry a
// per-day curve; some carry a cycle-by-cycle curve; CA 19-9 carries
// a cadence + biological-variation block instead of a curve). We
// validate the union and let consumers branch on the populated
// fields.
import { z } from "zod";
import rawCurves from "~/config/cycle-curves.json";
import type { ExpectedPoint } from "./types";

// --- Schema -------------------------------------------------------------

const dayPointSchema = z.object({
  cycle_day: z.number().int().min(1).max(28),
  expected_mean: z.number().nullable(),
  expected_sd: z.number().nullable(),
  // Some entries carry a per-point n_effective override; when absent
  // the metric-block-level `n_effective` applies.
  n_effective: z.number().int().min(0).max(10).optional(),
  note: z.string().optional(),
});

const cyclePointSchema = z.object({
  cycle_number: z.number().int().min(1),
  expected_mean: z.number().nullable(),
  expected_sd: z.number().nullable(),
  n_effective: z.number().int().min(0).max(10).optional(),
  incidence_grade_ge1_pct: z.number().min(0).max(100).optional(),
  incidence_grade_ge2_pct: z.number().min(0).max(100).optional(),
  incidence_grade_ge3_pct: z.number().min(0).max(100).optional(),
  note: z.string().optional(),
});

const detectorGuardsSchema = z.record(z.string(), z.string()).optional();

const metricBlockSchema = z.object({
  metric: z.string(),
  unit: z.string().optional(),
  scale: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  n_effective: z.number().int().min(0).max(10),
  // Either a per-day curve, a per-cycle curve, or null (cadence-style
  // metrics like CA 19-9). Validators below tighten this per metric.
  curve: z.union([
    z.array(dayPointSchema),
    z.array(cyclePointSchema),
    z.null(),
  ]).optional(),
  cadence: z.object({
    recommended_interval_days_min: z.number(),
    recommended_interval_days_max: z.number(),
    recommended_interval_days_default: z.number(),
    rationale: z.string().optional(),
  }).optional(),
  biological_variation: z.object({
    intra_individual_cv_pct: z.number(),
    inter_individual_cv_pct: z.number().optional(),
    rcv_unidirectional_p05_pct: z.number().optional(),
    rcv_bidirectional_p05_pct: z.number().optional(),
    noise_band_pct: z.number(),
    meaningful_change_band_pct: z.number(),
    source_population: z.string().optional(),
  }).optional(),
  patient_specific_overrides: z.record(z.string(), z.unknown()).optional(),
  confounders: z.array(z.string()).optional(),
  detector_guards: detectorGuardsSchema,
  median_time_to_grade3_days: z.number().optional(),
  median_time_grade3_to_grade1_days: z.number().optional(),
  lifetime_overall_pct_grade_ge1: z.number().optional(),
  lifetime_overall_pct_grade_ge3: z.number().optional(),
  citations: z.array(z.string()).optional(),
});

const regimenSchema = z.object({
  name: z.string(),
  description: z.string(),
  cycle_length_days: z.number().int().positive(),
  dose_days: z.array(z.number().int()),
  rest_days: z.array(z.number().int()),
});

const fileSchema = z.object({
  $schema_version: z.string(),
  regimen: regimenSchema,
  encoding_notes: z.record(z.string(), z.string()),
  citations: z.record(z.string(), z.string()),
}).catchall(metricBlockSchema);

export type CycleCurvesFile = z.infer<typeof fileSchema>;
export type MetricBlock = z.infer<typeof metricBlockSchema>;

// --- Load + cache --------------------------------------------------------

let cached: CycleCurvesFile | null = null;
let loadError: Error | null = null;

function load(): CycleCurvesFile {
  if (cached) return cached;
  if (loadError) throw loadError;
  try {
    cached = fileSchema.parse(rawCurves);
    return cached;
  } catch (err) {
    loadError = err instanceof Error
      ? err
      : new Error(String(err));
    throw loadError;
  }
}

/**
 * Eager validation hook — exposed so tests + a startup probe can fail
 * loudly if cycle-curves.json drifts out of schema. Idempotent.
 */
export function validateCycleCurves(): void {
  load();
}

/** Test seam — clears the module cache so tests can swap the JSON. */
export function _resetCycleCurvesCache(): void {
  cached = null;
  loadError = null;
}

// --- Public lookup -------------------------------------------------------

const RESERVED_KEYS = new Set([
  "$schema_version",
  "regimen",
  "encoding_notes",
  "citations",
]);

function metricBlock(metricId: string): MetricBlock | null {
  const file = load();
  if (RESERVED_KEYS.has(metricId)) return null;
  const block = (file as Record<string, unknown>)[metricId];
  if (!block) return null;
  // Already validated at load time, but the cast preserves type safety
  // for consumers calling with arbitrary string ids.
  return block as MetricBlock;
}

/**
 * Population-prior expected (mean, sd) for `metricId` at `cycleDay`.
 * Returns null when:
 *  - the metric is not in the curves file
 *  - the metric has no per-day curve (e.g. ca199 — cadence-only)
 *  - the cycle_day is out of the encoded range
 *  - the per-day point is null/null (literature gap; personal data
 *    must populate it)
 *
 * Consumers should treat null as "no population prior available" —
 * detrend.ts falls through to a flat-expectation residual when the
 * lookup misses.
 */
export function expectedAt(
  metricId: string,
  cycleDay: number,
): ExpectedPoint | null {
  const block = metricBlock(metricId);
  if (!block || !Array.isArray(block.curve)) return null;
  const point = block.curve.find(
    (p): p is z.infer<typeof dayPointSchema> =>
      "cycle_day" in p && p.cycle_day === cycleDay,
  );
  if (!point) return null;
  if (point.expected_mean == null || point.expected_sd == null) return null;
  if (point.expected_sd === 0) return null;
  return {
    mean: point.expected_mean,
    sd: point.expected_sd,
    n_effective: point.n_effective ?? block.n_effective,
    source: "population",
  };
}

/**
 * Population-prior expected (mean, sd) for cycle-number-keyed metrics
 * (currently only `neuropathy_cumulative_by_cycle`).
 */
export function expectedAtCycle(
  metricId: string,
  cycleNumber: number,
): ExpectedPoint | null {
  const block = metricBlock(metricId);
  if (!block || !Array.isArray(block.curve)) return null;
  const point = block.curve.find(
    (p): p is z.infer<typeof cyclePointSchema> =>
      "cycle_number" in p && p.cycle_number === cycleNumber,
  );
  if (!point) return null;
  if (point.expected_mean == null || point.expected_sd == null) return null;
  if (point.expected_sd === 0) return null;
  return {
    mean: point.expected_mean,
    sd: point.expected_sd,
    n_effective: point.n_effective ?? block.n_effective,
    source: "population",
  };
}

/** Detector guards declared on a metric block (e.g. neuropathy survivor-bias). */
export function detectorGuards(metricId: string): Record<string, string> {
  const block = metricBlock(metricId);
  return block?.detector_guards ?? {};
}

/** Patient-specific overrides (e.g. CA 19-9 with biliary stent). */
export function patientOverride(
  metricId: string,
  conditionKey: string,
): Record<string, unknown> | null {
  const block = metricBlock(metricId);
  const overrides = block?.patient_specific_overrides;
  if (!overrides) return null;
  const cond = overrides[conditionKey];
  if (!cond || typeof cond !== "object") return null;
  return cond as Record<string, unknown>;
}

/** Regimen metadata — exposed so the detector layer can sanity-check inputs. */
export function regimen(): CycleCurvesFile["regimen"] {
  return load().regimen;
}
