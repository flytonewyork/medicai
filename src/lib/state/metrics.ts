// Metric registry — the single source of truth for "what signals exist, what
// axis do they belong to, where do we read them from". Every consumer that
// asks for a metric must look it up here; no rule should hardcode an axis
// assignment or fall back to raw Dexie row access.
//
// Axis assignment uses the most likely *driver* axis in the mPDAC-on-chemo
// context, not the anatomical origin. Rationale:
// - Nausea, fatigue, mucositis, neuropathy → drug (treatment-driven)
// - Pain, jaundice → tumour (cancer-driven)
// - Weight, appetite, sleep, mood, energy, practice → individual
// - Labs split per marker: CA 19-9 → tumour; ANC/platelets/Hb/LFTs → drug;
//   albumin → individual (nutrition).
import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
} from "~/types/clinical";
import type { MetricDefinition, Observation } from "./types";

export interface MetricExtractor {
  // Pull a time series of observations from whichever raw source this metric
  // lives in. Each source passes only what it owns: daily entries, labs, etc.
  fromDailies?: (rows: readonly DailyEntry[]) => Observation[];
  fromFortnightlies?: (
    rows: readonly FortnightlyAssessment[],
  ) => Observation[];
  fromLabs?: (rows: readonly LabResult[]) => Observation[];
}

export interface RegisteredMetric extends MetricDefinition, MetricExtractor {}

function daily(
  id: string,
  field: keyof DailyEntry,
): Pick<MetricExtractor, "fromDailies"> {
  return {
    fromDailies: (rows) =>
      rows
        .map((d) => {
          const raw = d[field];
          if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
          return { date: d.date, value: raw };
        })
        .filter((o): o is Observation => o !== null),
  };
}

function dailyBool(
  id: string,
  field: keyof DailyEntry,
): Pick<MetricExtractor, "fromDailies"> {
  // For boolean flags, encode as 0/1 so slope / baseline arithmetic still
  // works. A rising slope means the symptom is becoming more frequent.
  return {
    fromDailies: (rows) =>
      rows
        .map((d) => {
          const raw = d[field];
          if (typeof raw !== "boolean") return null;
          return { date: d.date, value: raw ? 1 : 0 };
        })
        .filter((o): o is Observation => o !== null),
  };
}

function fortnightly(
  field: keyof FortnightlyAssessment,
): Pick<MetricExtractor, "fromFortnightlies"> {
  return {
    fromFortnightlies: (rows) =>
      rows
        .map((r) => {
          const raw = r[field];
          if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
          return { date: r.assessment_date, value: raw };
        })
        .filter((o): o is Observation => o !== null),
  };
}

function lab(
  field: keyof LabResult,
): Pick<MetricExtractor, "fromLabs"> {
  return {
    fromLabs: (rows) =>
      rows
        .map((r) => {
          const raw = r[field];
          if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
          return { date: r.date, value: raw };
        })
        .filter((o): o is Observation => o !== null),
  };
}

// ─── Individual axis ───────────────────────────────────────────────────────

const INDIVIDUAL: RegisteredMetric[] = [
  {
    id: "weight_kg",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Body weight",
    unit: "kg",
    ...daily("weight_kg", "weight_kg"),
  },
  {
    id: "energy",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Energy",
    unit: "0-10",
    ...daily("energy", "energy"),
  },
  {
    id: "sleep_quality",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Sleep quality",
    unit: "0-10",
    ...daily("sleep_quality", "sleep_quality"),
  },
  {
    id: "appetite",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Appetite",
    unit: "0-10",
    ...daily("appetite", "appetite"),
  },
  {
    id: "mood_clarity",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Mood / mental clarity",
    unit: "0-10",
    ...daily("mood_clarity", "mood_clarity"),
  },
  {
    id: "steps",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Steps",
    ...daily("steps", "steps"),
  },
  {
    id: "protein_grams",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Protein intake",
    unit: "g",
    ...daily("protein_grams", "protein_grams"),
  },
  {
    id: "walking_minutes",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Walking",
    unit: "min",
    ...daily("walking_minutes", "walking_minutes"),
  },
  {
    id: "grip_dominant_kg",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 14,
    label: "Grip strength (dominant)",
    unit: "kg",
    ...fortnightly("grip_dominant_kg"),
  },
  {
    id: "gait_speed_ms",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 14,
    label: "Gait speed",
    unit: "m/s",
    ...fortnightly("gait_speed_ms"),
  },
  {
    id: "sts_5x_seconds",
    axis: "individual",
    polarity: "lower_better",
    cadence_days: 14,
    label: "5× sit-to-stand",
    unit: "s",
    ...fortnightly("sts_5x_seconds"),
  },
  {
    id: "tug_seconds",
    axis: "individual",
    polarity: "lower_better",
    cadence_days: 14,
    label: "Timed Up-and-Go",
    unit: "s",
    ...fortnightly("tug_seconds"),
  },
  {
    id: "phq9_total",
    axis: "individual",
    polarity: "lower_better",
    cadence_days: 14,
    label: "PHQ-9 (depression)",
    ...fortnightly("phq9_total"),
  },
  {
    id: "gad7_total",
    axis: "individual",
    polarity: "lower_better",
    cadence_days: 14,
    label: "GAD-7 (anxiety)",
    ...fortnightly("gad7_total"),
  },
  {
    id: "distress_thermometer",
    axis: "individual",
    polarity: "lower_better",
    cadence_days: 14,
    label: "Distress thermometer",
    ...fortnightly("distress_thermometer"),
  },
  {
    id: "albumin",
    axis: "individual",
    polarity: "higher_better",
    cadence_days: 14,
    label: "Albumin",
    unit: "g/L",
    ...lab("albumin"),
  },
];

// ─── Tumour axis ───────────────────────────────────────────────────────────

const TUMOUR: RegisteredMetric[] = [
  {
    id: "ca199",
    axis: "tumour",
    polarity: "lower_better",
    cadence_days: 28,
    label: "CA 19-9",
    unit: "U/mL",
    ...lab("ca199"),
  },
  {
    id: "cea",
    axis: "tumour",
    polarity: "lower_better",
    cadence_days: 28,
    label: "CEA",
    ...lab("cea"),
  },
  {
    id: "pain_current",
    axis: "tumour",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Pain (current)",
    unit: "0-10",
    ...daily("pain_current", "pain_current"),
  },
  {
    id: "pain_worst",
    axis: "tumour",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Pain (worst 24h)",
    unit: "0-10",
    ...daily("pain_worst", "pain_worst"),
  },
  {
    id: "dyspnoea_flag",
    axis: "tumour",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Dyspnoea (daily flag)",
    ...dailyBool("dyspnoea_flag", "dyspnoea"),
  },
];

// ─── Drug axis ─────────────────────────────────────────────────────────────

const DRUG: RegisteredMetric[] = [
  {
    id: "nausea",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Nausea",
    unit: "0-10",
    ...daily("nausea", "nausea"),
  },
  {
    id: "diarrhoea_count",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Diarrhoea episodes",
    ...daily("diarrhoea_count", "diarrhoea_count"),
  },
  {
    id: "neuropathy_hands_flag",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Neuropathy — hands (daily flag)",
    ...dailyBool("neuropathy_hands_flag", "neuropathy_hands"),
  },
  {
    id: "neuropathy_feet_flag",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Neuropathy — feet (daily flag)",
    ...dailyBool("neuropathy_feet_flag", "neuropathy_feet"),
  },
  {
    id: "cold_dysaesthesia_flag",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Cold dysaesthesia (daily flag)",
    ...dailyBool("cold_dysaesthesia_flag", "cold_dysaesthesia"),
  },
  {
    id: "mouth_sores_flag",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 1,
    label: "Mucositis (daily flag)",
    ...dailyBool("mouth_sores_flag", "mouth_sores"),
  },
  {
    id: "neuropathy_grade",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 14,
    label: "Neuropathy grade (CTCAE)",
    ...fortnightly("neuropathy_grade"),
  },
  {
    id: "neutrophils",
    axis: "drug",
    polarity: "higher_better",
    cadence_days: 7,
    label: "ANC",
    unit: "×10⁹/L",
    ...lab("neutrophils"),
  },
  {
    id: "platelets",
    axis: "drug",
    polarity: "higher_better",
    cadence_days: 7,
    label: "Platelets",
    unit: "×10⁹/L",
    ...lab("platelets"),
  },
  {
    id: "hemoglobin",
    axis: "drug",
    polarity: "higher_better",
    cadence_days: 7,
    label: "Haemoglobin",
    unit: "g/L",
    ...lab("hemoglobin"),
  },
  {
    id: "alt",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 14,
    label: "ALT",
    unit: "U/L",
    ...lab("alt"),
  },
  {
    id: "ast",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 14,
    label: "AST",
    unit: "U/L",
    ...lab("ast"),
  },
  {
    id: "bilirubin",
    axis: "drug",
    polarity: "lower_better",
    cadence_days: 14,
    label: "Bilirubin",
    unit: "µmol/L",
    ...lab("bilirubin"),
  },
];

// ─── External axis ─────────────────────────────────────────────────────────
// Slice 3 populates this with patient-reported social-connectedness signals.
// Weather and care-team-contact metrics are derived at detector-time rather
// than captured per day, so they don't appear here.

const EXTERNAL: RegisteredMetric[] = [
  {
    id: "meaningful_interactions",
    axis: "external",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Meaningful interactions",
    unit: "count/day",
    ...daily("meaningful_interactions", "meaningful_interactions"),
  },
  {
    id: "carer_present_flag",
    axis: "external",
    polarity: "higher_better",
    cadence_days: 1,
    label: "Carer presence (daily flag)",
    ...dailyBool("carer_present_flag", "carer_present"),
  },
];

export const METRIC_REGISTRY: readonly RegisteredMetric[] = [
  ...INDIVIDUAL,
  ...TUMOUR,
  ...DRUG,
  ...EXTERNAL,
];

export const METRICS_BY_ID: Record<string, RegisteredMetric> =
  Object.fromEntries(METRIC_REGISTRY.map((m) => [m.id, m]));
