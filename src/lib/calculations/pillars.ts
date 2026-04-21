import type {
  ComprehensiveAssessment,
  PillarScores,
} from "~/types/clinical";

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function weightedAverage(
  entries: Array<[number, number]>,
): number | undefined {
  // entries: [value, weight]
  const nonEmpty = entries.filter(
    ([v]) => typeof v === "number" && Number.isFinite(v),
  );
  if (nonEmpty.length === 0) return undefined;
  const sumW = nonEmpty.reduce((a, [, w]) => a + w, 0);
  if (sumW === 0) return undefined;
  const sum = nonEmpty.reduce((a, [v, w]) => a + v * w, 0);
  return clamp(sum / sumW);
}

// ECOG: 0→100, 1→85, 2→55, 3→25, 4→0
function ecogScore(ecog?: number): number | undefined {
  if (ecog === undefined || ecog === null) return undefined;
  return [100, 85, 55, 25, 0][Math.max(0, Math.min(4, ecog))];
}

// Grip: age/sex norms require profile data; use simple thresholds
// (adult male: <27 kg low per EWGSOP2; >40 kg healthy).
function gripScore(kg?: number): number | undefined {
  if (typeof kg !== "number") return undefined;
  if (kg >= 40) return 100;
  if (kg >= 35) return 90;
  if (kg >= 30) return 80;
  if (kg >= 27) return 65;
  if (kg >= 20) return 45;
  if (kg >= 15) return 25;
  return 10;
}

// Gait speed m/s: >1.2 normal, <0.8 frailty.
function gaitScore(ms?: number): number | undefined {
  if (typeof ms !== "number") return undefined;
  if (ms >= 1.2) return 100;
  if (ms >= 1.0) return 85;
  if (ms >= 0.8) return 60;
  if (ms >= 0.6) return 30;
  return 10;
}

function sts30Score(reps?: number): number | undefined {
  if (typeof reps !== "number") return undefined;
  if (reps >= 14) return 100;
  if (reps >= 11) return 85;
  if (reps >= 8) return 65;
  if (reps >= 5) return 40;
  return 10;
}

function sts5xScore(seconds?: number): number | undefined {
  if (typeof seconds !== "number" || seconds <= 0) return undefined;
  if (seconds <= 10) return 100;
  if (seconds <= 12) return 85;
  if (seconds <= 15) return 65;
  if (seconds <= 18) return 40;
  return 15;
}

function tugScore(seconds?: number): number | undefined {
  if (typeof seconds !== "number" || seconds <= 0) return undefined;
  if (seconds <= 10) return 100;
  if (seconds <= 12) return 85;
  if (seconds <= 14) return 65;
  if (seconds <= 20) return 40;
  return 15;
}

function singleLegStanceScore(seconds?: number): number | undefined {
  if (typeof seconds !== "number") return undefined;
  if (seconds >= 30) return 100;
  if (seconds >= 20) return 85;
  if (seconds >= 10) return 65;
  if (seconds >= 5) return 35;
  return 10;
}

function sarcfScore(total?: number): number | undefined {
  if (typeof total !== "number") return undefined;
  return clamp(100 - total * 10);
}

function functionalWeightScore(
  weight?: number,
  baseline?: number,
): number | undefined {
  if (typeof weight !== "number" || typeof baseline !== "number") return undefined;
  const pct = ((weight - baseline) / baseline) * 100;
  if (pct >= -2) return 100;
  if (pct >= -5) return 85;
  if (pct >= -10) return 60;
  if (pct >= -15) return 35;
  return 10;
}

export function computeFunctionalScore(
  a: Partial<ComprehensiveAssessment>,
  baselineWeight?: number,
): number | undefined {
  return weightedAverage([
    [ecogScore(a.ecog_self) ?? NaN, 3],
    [gripScore(a.grip_dominant_kg) ?? NaN, 2],
    [gaitScore(a.gait_speed_ms) ?? NaN, 2],
    [sts30Score(a.sit_to_stand_30s) ?? NaN, 1.5],
    [sts5xScore(a.sts_5x_seconds) ?? NaN, 1],
    [tugScore(a.tug_seconds) ?? NaN, 1],
    [singleLegStanceScore(a.single_leg_stance_seconds) ?? NaN, 0.5],
    [sarcfScore(a.sarc_f_total) ?? NaN, 1.5],
    [functionalWeightScore(a.weight_kg, baselineWeight) ?? NaN, 1],
  ]);
}

// 0-10 severity → inverted 0-100. 4-level ordinal → 0/33/66/100 inverted.
function inv10(n?: number): number | undefined {
  if (typeof n !== "number") return undefined;
  return clamp(100 - (n / 10) * 100);
}

function invOrdinal(n?: number, max = 4): number | undefined {
  if (typeof n !== "number") return undefined;
  return clamp(100 - (n / max) * 100);
}

export function computeSymptomScore(
  a: Partial<ComprehensiveAssessment>,
): number | undefined {
  return weightedAverage([
    [inv10(a.pain_worst) ?? NaN, 2],
    [inv10(a.pain_interference) ?? NaN, 1.5],
    [inv10(a.fatigue_severity) ?? NaN, 1.5],
    [inv10(a.fatigue_interference) ?? NaN, 1],
    [inv10(a.nausea_severity) ?? NaN, 1],
    [invOrdinal(a.vomiting_frequency) ?? NaN, 0.8],
    [invOrdinal(a.diarrhoea_frequency) ?? NaN, 0.8],
    [inv10(a.constipation_severity) ?? NaN, 0.5],
    [a.jaundice ? 0 : 100, 0.7],
    [inv10(a.pruritus_severity) ?? NaN, 0.4],
    [invOrdinal(a.dyspnoea_severity) ?? NaN, 1],
    [invOrdinal(a.cough_severity) ?? NaN, 0.4],
    [a.fever_recent ? 30 : 100, 0.5],
    [a.night_sweats ? 50 : 100, 0.4],
    // Appetite is positive-scored: 10 → 100, 0 → 0
    [typeof a.appetite_rating === "number" ? a.appetite_rating * 10 : NaN, 0.8],
  ]);
}

function neuropathyScore(grade?: number): number | undefined {
  if (typeof grade !== "number") return undefined;
  return [100, 80, 55, 25, 0][Math.max(0, Math.min(4, grade))];
}

export function computeToxicityScore(
  a: Partial<ComprehensiveAssessment>,
): number | undefined {
  const overall =
    typeof a.neuropathy_grade_overall === "number"
      ? a.neuropathy_grade_overall
      : Math.max(
          a.neuropathy_hands_grade ?? 0,
          a.neuropathy_feet_grade ?? 0,
        );
  return weightedAverage([
    [neuropathyScore(overall) ?? NaN, 2.5],
    [inv10(a.cold_dysaesthesia_severity) ?? NaN, 0.8],
    [inv10(a.mucositis_severity) ?? NaN, 0.8],
    [inv10(a.cognitive_concern) ?? NaN, 1],
    [a.skin_changes ? 55 : 100, 0.4],
    [a.nail_changes ? 65 : 100, 0.3],
    [a.easy_bruising ? 50 : 100, 0.5],
  ]);
}

export function computeMentalScore(
  a: Partial<ComprehensiveAssessment>,
): number | undefined {
  // PHQ-9: 0→100, 27→0. GAD-7: 0→100, 21→0. Distress: 0-10 → 100-0.
  const components: Array<[number, number]> = [];
  if (typeof a.phq9_total === "number") {
    components.push([clamp(100 - (a.phq9_total / 27) * 100), 1.5]);
  }
  if (typeof a.gad7_total === "number") {
    components.push([clamp(100 - (a.gad7_total / 21) * 100), 1.5]);
  }
  if (typeof a.distress_thermometer === "number") {
    components.push([clamp(100 - (a.distress_thermometer / 10) * 100), 1]);
  }
  if (typeof a.sleep_quality === "number") {
    components.push([clamp(a.sleep_quality * 10), 1]);
  }
  return weightedAverage(components);
}

export function computeSpiritualScore(
  a: Partial<ComprehensiveAssessment>,
): number | undefined {
  // FACIT-Sp-12 subset: 0-4 per item. We store a total.
  // Also factor in practice completion in past week (0-7).
  const components: Array<[number, number]> = [];
  if (typeof a.facitsp_total === "number") {
    const maxTotal = (a.facitsp_responses?.length ?? 12) * 4;
    components.push([clamp((a.facitsp_total / maxTotal) * 100), 2]);
  }
  if (typeof a.practice_days_past_week === "number") {
    components.push([clamp((a.practice_days_past_week / 7) * 100), 1]);
  }
  return weightedAverage(components);
}

export function computePillars(
  a: Partial<ComprehensiveAssessment>,
  baselineWeight?: number,
): PillarScores {
  const functional = computeFunctionalScore(a, baselineWeight) ?? 0;
  const symptom = computeSymptomScore(a) ?? 100;
  const toxicity = computeToxicityScore(a) ?? 100;
  const mental = computeMentalScore(a) ?? 100;
  const spiritual = computeSpiritualScore(a) ?? 50;

  // Framework: function weighted highest.
  const anchor_index = clamp(
    0.45 * functional +
      0.2 * symptom +
      0.2 * toxicity +
      0.1 * mental +
      0.05 * spiritual,
  );
  return {
    functional_score: Math.round(functional),
    symptom_score: Math.round(symptom),
    toxicity_score: Math.round(toxicity),
    mental_score: Math.round(mental),
    spiritual_score: Math.round(spiritual),
    anchor_index: Math.round(anchor_index),
  };
}
