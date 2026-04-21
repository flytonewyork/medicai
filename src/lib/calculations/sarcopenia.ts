import type {
  FortnightlyAssessment,
  Settings,
} from "~/types/clinical";

export interface SarcopeniaAssessment {
  sarcfScore?: number;
  sarcfPositive: boolean;
  lowGrip: boolean;
  lowGaitSpeed: boolean;
  lowCalf: boolean;
  lowSts5x: boolean;
  lowStsReps: boolean;
  level: "low" | "at-risk" | "probable" | "confirmed";
  signals: string[];
}

// EWGSOP2 male/female cut-points — applied generously; clinical
// interpretation still required.
const GRIP_LOW_MALE = 27;
const GRIP_LOW_FEMALE = 16;
const CALF_LOW_MALE = 34;
const CALF_LOW_FEMALE = 33;
const GAIT_LOW = 0.8;
const STS_5X_SEVERE = 15;
const STS_30S_LOW = 10;

export function scoreSarcF(responses: number[]): number {
  if (responses.length !== 5) {
    throw new Error(`SARC-F requires 5 responses, got ${responses.length}`);
  }
  return responses.reduce((a, b) => a + b, 0);
}

export function assessSarcopenia(
  f: FortnightlyAssessment | null,
  settings: Settings | null,
  sex: "male" | "female" = "male",
): SarcopeniaAssessment {
  const signals: string[] = [];

  const sarcfScore =
    f?.sarc_f_total ??
    (f?.sarc_f_responses && f.sarc_f_responses.length === 5
      ? scoreSarcF(f.sarc_f_responses)
      : undefined);
  const sarcfPositive = (sarcfScore ?? 0) >= 4;
  if (sarcfPositive) signals.push(`SARC-F ${sarcfScore} ≥ 4`);

  const gripThreshold = sex === "female" ? GRIP_LOW_FEMALE : GRIP_LOW_MALE;
  const gripValue = f?.grip_dominant_kg ?? settings?.baseline_grip_dominant_kg;
  const lowGrip = typeof gripValue === "number" && gripValue < gripThreshold;
  if (lowGrip) signals.push(`Grip ${gripValue} kg below ${gripThreshold}`);

  const gaitValue = f?.gait_speed_ms;
  const lowGaitSpeed = typeof gaitValue === "number" && gaitValue < GAIT_LOW;
  if (lowGaitSpeed) signals.push(`Gait ${gaitValue} m/s below ${GAIT_LOW}`);

  const calfThreshold = sex === "female" ? CALF_LOW_FEMALE : CALF_LOW_MALE;
  const calfValue =
    f?.calf_circumference_cm ?? settings?.baseline_calf_cm;
  const lowCalf = typeof calfValue === "number" && calfValue < calfThreshold;
  if (lowCalf) signals.push(`Calf ${calfValue} cm below ${calfThreshold}`);

  const lowSts5x =
    typeof f?.sts_5x_seconds === "number" && f.sts_5x_seconds > STS_5X_SEVERE;
  if (lowSts5x) signals.push(`5× STS ${f?.sts_5x_seconds} s above 15 s`);

  const lowStsReps =
    typeof f?.sit_to_stand_30s === "number" &&
    f.sit_to_stand_30s < STS_30S_LOW;
  if (lowStsReps) signals.push(`30-s STS ${f?.sit_to_stand_30s} reps below 10`);

  let level: SarcopeniaAssessment["level"] = "low";
  const hasLowMuscleMass = lowCalf;
  const hasLowStrength = lowGrip || lowSts5x || lowStsReps;
  const hasLowPerformance = lowGaitSpeed;

  if (sarcfPositive || hasLowStrength) level = "at-risk";
  if ((hasLowStrength && hasLowMuscleMass) || (hasLowStrength && hasLowPerformance)) {
    level = "probable";
  }
  if (hasLowStrength && hasLowMuscleMass && hasLowPerformance) {
    level = "confirmed";
  }

  return {
    sarcfScore,
    sarcfPositive,
    lowGrip,
    lowGaitSpeed,
    lowCalf,
    lowSts5x,
    lowStsReps,
    level,
    signals,
  };
}

export function sarcopeniaLevelLabel(
  level: SarcopeniaAssessment["level"],
  locale: "en" | "zh",
): string {
  const labels = {
    en: {
      low: "Low risk",
      "at-risk": "At risk",
      probable: "Probable sarcopenia",
      confirmed: "Confirmed sarcopenia",
    },
    zh: {
      low: "风险低",
      "at-risk": "有风险",
      probable: "疑似肌少症",
      confirmed: "确诊肌少症",
    },
  };
  return labels[locale][level];
}
