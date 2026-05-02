// V2 rule set. During the analytical-layer rollout (Sprint 2 Phase 2-5)
// this evaluates in shadow alongside V1 — its alerts go to
// `zone_alerts_shadow`, not `zone_alerts`, so the patient feed is
// unaffected while we tune V2 against Hu Lin's actual history.
//
// Phase 3 strategy: ADD chronic-drift rules alongside the V1 threshold
// rules rather than replacing. Most V1 rules ask "is the latest single
// reading X% off baseline?" — that fires on any single bad day. The V2
// additions ask "is the chronic component drifting?" via a slope over a
// trailing window. The patient who is sliding into axis-3 toxicity will
// trip the V2 chronic rule weeks before the V1 threshold rule fires;
// the patient who has one bad day will trip neither. The diff helper
// will surface every V2-only fire in the shadow stream so Thomas can
// confirm the early-fires are real signal before Phase 5 cutover.
//
// Phase 5: V1 retired, this list becomes `ZONE_RULES`, files renamed.
import type { ClinicalSnapshot, ZoneRule } from "./types";
import { ZONE_RULES } from "./zone-rules";

// Thresholds expressed in metric-native units per day so they map
// cleanly onto `MetricTrajectory.slope_28d`. Provisional values;
// tuned against Hu Lin's cycle-fit in Phase 4.
//
// Grip: -0.0714 kg/day ≈ -2 kg/28d ≈ "noticeably more loss than
// expected month-over-month"; -0.143 kg/day ≈ -4 kg/28d ≈ "clinically
// alarming chronic decline."
const GRIP_SLOPE_YELLOW_KG_PER_DAY = -2 / 28;
const GRIP_SLOPE_ORANGE_KG_PER_DAY = -4 / 28;

// Steps: -1000/28 ≈ -36 steps/day ≈ "1000-step monthly decline" —
// roughly 14% of a 7000-step baseline. -2000/28 ≈ -71 steps/day ≈
// 28% baseline. The detector at `state/detectors/steps-decline.ts`
// uses 10% / 20% pct-below-baseline; this slope-based rule is a
// complementary chronic signal that fires on shallow drift the
// pct-below check misses.
const STEPS_SLOPE_YELLOW_PER_DAY = -1000 / 28;
const STEPS_SLOPE_ORANGE_PER_DAY = -2000 / 28;

function gripSlope28d(s: ClinicalSnapshot): number | null {
  const m = s.patient_state.metrics["grip_dominant_kg"];
  if (!m || !m.fresh) return null;
  return m.slope_28d ?? null;
}

function stepsSlope28d(s: ClinicalSnapshot): number | null {
  const m = s.patient_state.metrics["steps"];
  if (!m || !m.fresh) return null;
  return m.slope_28d ?? null;
}

const gripChronicDriftYellow: ZoneRule = {
  id: "grip_chronic_drift_yellow",
  name: "Grip strength chronic decline (V2)",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: (s) => {
    const slope = gripSlope28d(s);
    if (slope === null) return false;
    return (
      slope <= GRIP_SLOPE_YELLOW_KG_PER_DAY &&
      slope > GRIP_SLOPE_ORANGE_KG_PER_DAY
    );
  },
  recommendation:
    "Grip strength is drifting downward across recent fortnightlies. Exercise physiology referral; intensify resistance training.",
  recommendationZh:
    "近期握力呈持续下降趋势。建议转介运动生理学评估，并加强抗阻训练。",
  suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
};

const gripChronicDriftOrange: ZoneRule = {
  id: "grip_chronic_drift_orange",
  name: "Grip strength chronic decline (V2, severe)",
  zone: "orange",
  category: "function",
  triggersReview: true,
  evaluator: (s) => {
    const slope = gripSlope28d(s);
    if (slope === null) return false;
    return slope <= GRIP_SLOPE_ORANGE_KG_PER_DAY;
  },
  recommendation:
    "Grip strength is declining at a clinically alarming rate. Mandatory review: nutrition, dose intensity, exercise physiology.",
  recommendationZh:
    "握力下降速度已达到临床警戒水平。需立即评估营养、化疗剂量与运动生理。",
  suggestedLevers: [
    "physical.exercise_phys",
    "nutrition.protein",
    "intensity.dose_reduce",
  ],
};

const stepsChronicDeclineYellow: ZoneRule = {
  id: "steps_chronic_decline_yellow",
  name: "Steps chronic decline (V2)",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: (s) => {
    const slope = stepsSlope28d(s);
    if (slope === null) return false;
    return (
      slope <= STEPS_SLOPE_YELLOW_PER_DAY &&
      slope > STEPS_SLOPE_ORANGE_PER_DAY
    );
  },
  recommendation:
    "Daily step count is drifting downward. Review activity scheduling, fatigue management, and address sleep/pain interference. Re-check after the next cycle.",
  recommendationZh:
    "每日步数呈持续下降趋势。重新安排活动节奏，管理疲劳与睡眠/疼痛干扰，下个周期后复评。",
  suggestedLevers: [
    "physical.exercise_phys",
    "fatigue.scheduling",
    "sleep.review",
  ],
};

const stepsChronicDeclineOrange: ZoneRule = {
  id: "steps_chronic_decline_orange",
  name: "Steps chronic decline (V2, severe)",
  zone: "orange",
  category: "function",
  triggersReview: true,
  evaluator: (s) => {
    const slope = stepsSlope28d(s);
    if (slope === null) return false;
    return slope <= STEPS_SLOPE_ORANGE_PER_DAY;
  },
  recommendation:
    "Steps are declining at a rate that suggests significant functional erosion. Mandatory review: dose intensity, exercise physiology, fatigue + cachexia work-up.",
  recommendationZh:
    "步数下降速度提示功能明显流失。需立即评估化疗剂量、运动生理与疲劳/恶病质工作。",
  suggestedLevers: [
    "physical.exercise_phys",
    "intensity.dose_reduce",
    "nutrition.protein",
  ],
};

// V2 = V1 unchanged + the new chronic-drift detectors. Each addition
// has its own rule_id so the diff helper reports them as `v2_only`.
export const ZONE_RULES_V2: readonly ZoneRule[] = [
  ...ZONE_RULES,
  gripChronicDriftYellow,
  gripChronicDriftOrange,
  stepsChronicDeclineYellow,
  stepsChronicDeclineOrange,
];
