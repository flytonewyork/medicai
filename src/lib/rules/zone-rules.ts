import thresholds from "~/config/thresholds.json";
import { percentChange, consecutiveRising } from "~/lib/calculations/trends";
import type { ZoneRule } from "./types";

const weightLossYellow: ZoneRule = {
  id: "weight_loss_5_10_yellow",
  name: "Weight loss 5–10% from baseline",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ settings, latestDaily }) => {
    if (!settings?.baseline_weight_kg || !latestDaily?.weight_kg) return false;
    const pct = Math.abs(
      percentChange(settings.baseline_weight_kg, latestDaily.weight_kg),
    );
    return pct >= thresholds.function.weight_loss_yellow_pct &&
      pct < thresholds.function.weight_loss_orange_pct;
  },
  recommendation:
    "Consider nutritional intervention, dietitian referral, PERT optimisation.",
  recommendationZh: "考虑营养干预，转介营养师，优化胰酶替代治疗。",
  suggestedLevers: ["nutrition.dietitian", "nutrition.supplements", "supportive.pert"],
};

const weightLossOrange: ZoneRule = {
  id: "weight_loss_10_plus_orange",
  name: "Weight loss >10% from baseline",
  zone: "orange",
  category: "function",
  triggersReview: true,
  evaluator: ({ settings, latestDaily }) => {
    if (!settings?.baseline_weight_kg || !latestDaily?.weight_kg) return false;
    const pct = Math.abs(
      percentChange(settings.baseline_weight_kg, latestDaily.weight_kg),
    );
    return pct >= thresholds.function.weight_loss_orange_pct;
  },
  recommendation:
    "Urgent nutritional review; consider feeding tube and accelerating bridge discussion.",
  recommendationZh: "紧急营养评估，考虑管饲和加快过渡到下一线治疗。",
  suggestedLevers: ["nutrition.feeding_tube", "bridge.accelerate", "intensity.dose_reduce"],
};

const gripDeclineYellow: ZoneRule = {
  id: "grip_decline_10_20_yellow",
  name: "Grip strength decline 10–20% from baseline",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ settings, latestFortnightly }) => {
    if (
      !settings?.baseline_grip_dominant_kg ||
      !latestFortnightly?.grip_dominant_kg
    ) {
      return false;
    }
    const pct = Math.abs(
      percentChange(
        settings.baseline_grip_dominant_kg,
        latestFortnightly.grip_dominant_kg,
      ),
    );
    return pct >= thresholds.function.grip_decline_yellow_pct &&
      pct < thresholds.function.grip_decline_orange_pct;
  },
  recommendation:
    "Exercise physiology referral, resistance training intensification.",
  recommendationZh: "转介运动生理学家，加强抗阻训练。",
  suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
};

const gripDeclineOrange: ZoneRule = {
  id: "grip_decline_20_plus_orange",
  name: "Grip strength decline >20% from baseline",
  zone: "orange",
  category: "function",
  triggersReview: true,
  evaluator: ({ settings, latestFortnightly }) => {
    if (
      !settings?.baseline_grip_dominant_kg ||
      !latestFortnightly?.grip_dominant_kg
    ) {
      return false;
    }
    const pct = Math.abs(
      percentChange(
        settings.baseline_grip_dominant_kg,
        latestFortnightly.grip_dominant_kg,
      ),
    );
    return pct >= thresholds.function.grip_decline_orange_pct;
  },
  recommendation:
    "Urgent review; consider dose reduction to preserve function.",
  recommendationZh: "紧急评估，考虑减量以保留功能。",
  suggestedLevers: ["intensity.dose_reduce", "physical.exercise_phys"],
};

const gaitYellow: ZoneRule = {
  id: "gait_0_8_1_0_yellow",
  name: "Gait speed 0.8–1.0 m/s",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) => {
    const v = latestFortnightly?.gait_speed_ms;
    if (v === undefined) return false;
    return v >= thresholds.function.gait_yellow_ms &&
      v < thresholds.function.gait_warning_ms;
  },
  recommendation: "Physiotherapy referral, monitor for sarcopenia.",
  recommendationZh: "转介物理治疗，监测肌少症。",
  suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
};

const gaitOrange: ZoneRule = {
  id: "gait_lt_0_8_orange",
  name: "Gait speed <0.8 m/s",
  zone: "orange",
  category: "function",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) => {
    const v = latestFortnightly?.gait_speed_ms;
    if (v === undefined) return false;
    return v < thresholds.function.gait_yellow_ms;
  },
  recommendation:
    "Frailty territory; consider de-escalation and CGA-guided planning.",
  recommendationZh: "进入虚弱区间，考虑减量并进行全面老年评估。",
  suggestedLevers: ["intensity.dose_reduce", "physical.exercise_phys"],
};

const neuropathyYellow: ZoneRule = {
  id: "neuropathy_grade_2_yellow",
  name: "Neuropathy grade 2",
  zone: "yellow",
  category: "toxicity",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    latestFortnightly?.neuropathy_grade === 2,
  recommendation:
    "Consider duloxetine; plan dose reduction of nab-paclitaxel.",
  recommendationZh: "考虑度洛西汀；计划减量白蛋白紫杉醇。",
  suggestedLevers: ["supportive.duloxetine", "intensity.dose_reduce"],
};

const neuropathyOrange: ZoneRule = {
  id: "neuropathy_grade_3_orange",
  name: "Neuropathy grade 3",
  zone: "orange",
  category: "toxicity",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) => {
    const g = latestFortnightly?.neuropathy_grade ?? 0;
    return g >= 3;
  },
  recommendation: "Hold offending agent; active neuropathy management.",
  recommendationZh: "停用相关药物，积极管理神经病变。",
  suggestedLevers: ["intensity.hold", "supportive.duloxetine"],
};

const febrileNeutropeniaRed: ZoneRule = {
  id: "febrile_neutropenia_red",
  name: "Fever on treatment",
  zone: "red",
  category: "toxicity",
  triggersReview: true,
  evaluator: ({ latestDaily }) => !!latestDaily?.fever,
  recommendation:
    "IMMEDIATE hospital presentation — assume febrile neutropenia until ruled out.",
  recommendationZh: "立即前往医院 —— 除非排除，否则按发热性中性粒细胞减少处理。",
  suggestedLevers: ["emergency.hospital", "intensity.hold", "supportive.gcsf_prophylaxis"],
};

const ca199RisingYellow: ZoneRule = {
  id: "ca199_rising_3_consecutive_yellow",
  name: "CA19-9 rising for 3 consecutive measurements",
  zone: "yellow",
  category: "disease",
  triggersReview: true,
  evaluator: ({ recentLabs }) => {
    const ca199 = recentLabs
      .map((l) => l.ca199)
      .filter((v): v is number => typeof v === "number");
    if (ca199.length < 3) return false;
    const last3 = ca199.slice(-3);
    return consecutiveRising(last3) >= 3;
  },
  recommendation: "Consider early imaging review and ctDNA check.",
  recommendationZh: "考虑提前影像学复查和 ctDNA 检测。",
  suggestedLevers: ["monitoring.imaging_early", "monitoring.ctdna"],
};

const phq9ModerateYellow: ZoneRule = {
  id: "phq9_moderate_yellow",
  name: "PHQ-9 ≥10",
  zone: "yellow",
  category: "psychological",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.phq9_total ?? 0) >= thresholds.psychological.phq9_yellow_threshold &&
    (latestFortnightly?.phq9_total ?? 0) < thresholds.psychological.phq9_orange_threshold,
  recommendation: "Psychology referral; consider medication if persistent.",
  recommendationZh: "转介心理治疗，若持续则考虑药物。",
  suggestedLevers: ["psychological.psychology", "psychological.medication"],
};

const phq9SevereOrange: ZoneRule = {
  id: "phq9_severe_orange",
  name: "PHQ-9 ≥15",
  zone: "orange",
  category: "psychological",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.phq9_total ?? 0) >= thresholds.psychological.phq9_orange_threshold,
  recommendation: "Urgent psychological support; assess suicide risk.",
  recommendationZh: "紧急心理支持；评估自杀风险。",
  suggestedLevers: ["psychological.psychology", "psychological.medication"],
};

const gad7ModerateYellow: ZoneRule = {
  id: "gad7_moderate_yellow",
  name: "GAD-7 ≥10",
  zone: "yellow",
  category: "psychological",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.gad7_total ?? 0) >= thresholds.psychological.gad7_yellow_threshold &&
    (latestFortnightly?.gad7_total ?? 0) < thresholds.psychological.gad7_orange_threshold,
  recommendation: "Psychology referral; anxiety management techniques.",
  recommendationZh: "转介心理治疗；焦虑管理策略。",
  suggestedLevers: ["psychological.psychology"],
};

const albuminYellow: ZoneRule = {
  id: "albumin_lt_30_yellow",
  name: "Albumin <30 g/L",
  zone: "yellow",
  category: "nutrition",
  triggersReview: true,
  evaluator: ({ recentLabs }) => {
    const recent = recentLabs[recentLabs.length - 1];
    if (!recent?.albumin) return false;
    return recent.albumin < thresholds.nutrition.albumin_yellow &&
      recent.albumin >= thresholds.nutrition.albumin_orange;
  },
  recommendation: "Nutritional intervention; check inflammatory markers.",
  recommendationZh: "营养干预；检查炎症标志物。",
  suggestedLevers: ["nutrition.dietitian", "nutrition.supplements"],
};

const albuminOrange: ZoneRule = {
  id: "albumin_lt_25_orange",
  name: "Albumin <25 g/L",
  zone: "orange",
  category: "nutrition",
  triggersReview: true,
  evaluator: ({ recentLabs }) => {
    const recent = recentLabs[recentLabs.length - 1];
    if (!recent?.albumin) return false;
    return recent.albumin < thresholds.nutrition.albumin_orange;
  },
  recommendation: "Severe hypoalbuminaemia; urgent nutrition and cause review.",
  recommendationZh: "严重低白蛋白血症；紧急营养和病因评估。",
  suggestedLevers: ["nutrition.feeding_tube", "nutrition.dietitian"],
};

const sarcFPositiveYellow: ZoneRule = {
  id: "sarc_f_positive_yellow",
  name: "SARC-F ≥ 4 (sarcopenia screen positive)",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.sarc_f_total ?? 0) >= 4,
  recommendation:
    "Sarcopenia screen positive. Confirm with grip + calf + gait; refer to exercise physiology; ensure protein intake ≥ 1.2 g/kg/day.",
  recommendationZh:
    "肌少症筛查阳性。结合握力、小腿围、步速确认；转介运动生理学家；蛋白摄入 ≥ 1.2 g/kg/天。",
  suggestedLevers: [
    "physical.exercise_phys",
    "physical.resistance",
    "nutrition.dietitian",
    "nutrition.supplements",
  ],
};

const tugElevatedYellow: ZoneRule = {
  id: "tug_gt_14_yellow",
  name: "Timed Up-and-Go > 14 s",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.tug_seconds ?? 0) > 14,
  recommendation:
    "Elevated fall risk. Exercise physiology referral; review home fall hazards.",
  recommendationZh: "跌倒风险升高。转介运动生理学家；排查居家跌倒隐患。",
  suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
};

const sts5xSlowYellow: ZoneRule = {
  id: "sts_5x_gt_15_yellow",
  name: "5× sit-to-stand > 15 s",
  zone: "yellow",
  category: "function",
  triggersReview: true,
  evaluator: ({ latestFortnightly }) =>
    (latestFortnightly?.sts_5x_seconds ?? 0) > 15,
  recommendation:
    "Lower-body strength low. Resistance training 2–3×/week, oncology exercise physiology referral.",
  recommendationZh:
    "下肢力量低。每周 2–3 次抗阻训练，转介肿瘤运动生理学家。",
  suggestedLevers: ["physical.resistance", "physical.exercise_phys"],
};

export const ZONE_RULES: ZoneRule[] = [
  weightLossYellow,
  weightLossOrange,
  gripDeclineYellow,
  gripDeclineOrange,
  gaitYellow,
  gaitOrange,
  neuropathyYellow,
  neuropathyOrange,
  febrileNeutropeniaRed,
  ca199RisingYellow,
  phq9ModerateYellow,
  phq9SevereOrange,
  gad7ModerateYellow,
  albuminYellow,
  albuminOrange,
  sarcFPositiveYellow,
  tugElevatedYellow,
  sts5xSlowYellow,
];
