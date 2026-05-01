import thresholds from "~/config/thresholds.json";
import { percentChange, consecutiveRising } from "~/lib/calculations/trends";
import type { ClinicalSnapshot, ZoneRule } from "./types";

// Predicate helpers — `inBand` is the half-open `[lo, hi)` window the
// rules use for both directions; the rule picks lo/hi to encode whether
// "lower is worse" (gait/albumin) or "higher is worse" (PHQ-9/GAD-7).
const inBand = (v: number, lo: number, hi: number) => v >= lo && v < hi;
const gte = (v: number, t: number) => v >= t;
const lt = (v: number, t: number) => v < t;

// Metric accessors. Each returns either the computed value or null when
// the snapshot doesn't have what's needed — callers fall through to
// `false` when the value is null.
function weightLossPct(s: ClinicalSnapshot): number | null {
  const b = s.settings?.baseline_weight_kg;
  const c = s.latestDaily?.weight_kg;
  return b && c ? Math.abs(percentChange(b, c)) : null;
}

function gripDeclinePct(s: ClinicalSnapshot): number | null {
  const b = s.settings?.baseline_grip_dominant_kg;
  const c = s.latestFortnightly?.grip_dominant_kg;
  return b && c ? Math.abs(percentChange(b, c)) : null;
}

const latestAlbumin = (s: ClinicalSnapshot): number | undefined =>
  s.recentLabs[s.recentLabs.length - 1]?.albumin;

// Count how many of the last `windowDays` daily entries (most recent
// first) reported loose stools — Bristol ≥ 6 OR raw count above the
// yellow threshold OR explicit steatorrhoea/oil flag. Used by the
// "persistent loose stools" rule below; PERT under-titration usually
// shows up as 3+ days running rather than a single bad day.
function loosStoolDayStreak(s: ClinicalSnapshot, windowDays: number): number {
  const recent = [...s.recentDailies]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, windowDays);
  let streak = 0;
  for (const d of recent) {
    const looseByBristol =
      typeof d.stool_bristol === "number" &&
      d.stool_bristol >= GI.loose_stool_bristol_min;
    const looseByCount =
      typeof d.stool_count === "number" &&
      d.stool_count >= GI.stool_count_yellow;
    const looseByDiarrhoeaCount =
      typeof d.diarrhoea_count === "number" &&
      d.diarrhoea_count >= GI.stool_count_yellow;
    const looseByOil = d.stool_oil === true || d.steatorrhoea === true;
    if (looseByBristol || looseByCount || looseByDiarrhoeaCount || looseByOil) {
      streak += 1;
    } else if (streak > 0) {
      // Break the streak on the first non-loose day; we want consecutive
      // recent days, not "any 3 of the last 5".
      break;
    }
  }
  return streak;
}

function constipationDayStreak(
  s: ClinicalSnapshot,
  windowDays: number,
): number {
  const recent = [...s.recentDailies]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, windowDays);
  let streak = 0;
  for (const d of recent) {
    const constipated =
      (typeof d.stool_bristol === "number" &&
        d.stool_bristol <= GI.constipation_bristol_max) ||
      (typeof d.stool_count === "number" && d.stool_count === 0);
    if (constipated) streak += 1;
    else if (streak > 0) break;
  }
  return streak;
}

const FN = thresholds.function;
const PSY = thresholds.psychological;
const NUT = thresholds.nutrition;
const DIS = thresholds.disease;
const GI = thresholds.gi;

const MS_PER_DAY = 24 * 3600 * 1000;

export const ZONE_RULES: ZoneRule[] = [
  {
    id: "weight_loss_5_10_yellow",
    name: "Weight loss 5–10% from baseline",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: (s) => {
      const pct = weightLossPct(s);
      return pct !== null && inBand(pct, FN.weight_loss_yellow_pct, FN.weight_loss_orange_pct);
    },
    recommendation:
      "Consider nutritional intervention, dietitian referral, PERT optimisation.",
    recommendationZh: "考虑营养干预，转介营养师，优化胰酶替代治疗。",
    suggestedLevers: ["nutrition.dietitian", "nutrition.supplements", "supportive.pert"],
  },
  {
    id: "weight_loss_10_plus_orange",
    name: "Weight loss >10% from baseline",
    zone: "orange",
    category: "function",
    triggersReview: true,
    evaluator: (s) => {
      const pct = weightLossPct(s);
      return pct !== null && gte(pct, FN.weight_loss_orange_pct);
    },
    recommendation:
      "Urgent nutritional review; consider feeding tube and accelerating bridge discussion.",
    recommendationZh: "紧急营养评估，考虑管饲和加快过渡到下一线治疗。",
    suggestedLevers: ["nutrition.feeding_tube", "bridge.accelerate", "intensity.dose_reduce"],
  },
  {
    id: "grip_decline_10_20_yellow",
    name: "Grip strength decline 10–20% from baseline",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: (s) => {
      const pct = gripDeclinePct(s);
      return pct !== null && inBand(pct, FN.grip_decline_yellow_pct, FN.grip_decline_orange_pct);
    },
    recommendation:
      "Exercise physiology referral, resistance training intensification.",
    recommendationZh: "转介运动生理学家，加强抗阻训练。",
    suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
  },
  {
    id: "grip_decline_20_plus_orange",
    name: "Grip strength decline >20% from baseline",
    zone: "orange",
    category: "function",
    triggersReview: true,
    evaluator: (s) => {
      const pct = gripDeclinePct(s);
      return pct !== null && gte(pct, FN.grip_decline_orange_pct);
    },
    recommendation: "Urgent review; consider dose reduction to preserve function.",
    recommendationZh: "紧急评估，考虑减量以保留功能。",
    suggestedLevers: ["intensity.dose_reduce", "physical.exercise_phys"],
  },
  {
    id: "gait_0_8_1_0_yellow",
    name: "Gait speed 0.8–1.0 m/s",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) => {
      const v = latestFortnightly?.gait_speed_ms;
      return v !== undefined && inBand(v, FN.gait_yellow_ms, FN.gait_warning_ms);
    },
    recommendation: "Physiotherapy referral, monitor for sarcopenia.",
    recommendationZh: "转介物理治疗，监测肌少症。",
    suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
  },
  {
    id: "gait_lt_0_8_orange",
    name: "Gait speed <0.8 m/s",
    zone: "orange",
    category: "function",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) => {
      const v = latestFortnightly?.gait_speed_ms;
      return v !== undefined && lt(v, FN.gait_yellow_ms);
    },
    recommendation:
      "Frailty territory; consider de-escalation and CGA-guided planning.",
    recommendationZh: "进入虚弱区间，考虑减量并进行全面老年评估。",
    suggestedLevers: ["intensity.dose_reduce", "physical.exercise_phys"],
  },
  {
    id: "neuropathy_grade_2_yellow",
    name: "Neuropathy grade 2",
    zone: "yellow",
    category: "toxicity",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) => latestFortnightly?.neuropathy_grade === 2,
    recommendation: "Consider duloxetine; plan dose reduction of nab-paclitaxel.",
    recommendationZh: "考虑度洛西汀；计划减量白蛋白紫杉醇。",
    suggestedLevers: ["supportive.duloxetine", "intensity.dose_reduce"],
  },
  {
    id: "neuropathy_grade_3_orange",
    name: "Neuropathy grade 3",
    zone: "orange",
    category: "toxicity",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      gte(latestFortnightly?.neuropathy_grade ?? 0, 3),
    recommendation: "Hold offending agent; active neuropathy management.",
    recommendationZh: "停用相关药物，积极管理神经病变。",
    suggestedLevers: ["intensity.hold", "supportive.duloxetine"],
  },
  {
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
  },
  {
    id: "ca199_rising_3_consecutive_yellow",
    name: "CA19-9 rising for 3 consecutive measurements",
    zone: "yellow",
    category: "disease",
    triggersReview: true,
    evaluator: ({ recentLabs }) => {
      const ca199 = recentLabs
        .map((l) => l.ca199)
        .filter((v): v is number => typeof v === "number");
      return ca199.length >= 3 && consecutiveRising(ca199.slice(-3)) >= 3;
    },
    recommendation: "Consider early imaging review and ctDNA check.",
    recommendationZh: "考虑提前影像学复查和 ctDNA 检测。",
    suggestedLevers: ["monitoring.imaging_early", "monitoring.ctdna"],
  },
  {
    id: "phq9_moderate_yellow",
    name: "PHQ-9 ≥10",
    zone: "yellow",
    category: "psychological",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      inBand(
        latestFortnightly?.phq9_total ?? 0,
        PSY.phq9_yellow_threshold,
        PSY.phq9_orange_threshold,
      ),
    recommendation: "Psychology referral; consider medication if persistent.",
    recommendationZh: "转介心理治疗，若持续则考虑药物。",
    suggestedLevers: ["psychological.psychology", "psychological.medication"],
  },
  {
    id: "phq9_severe_orange",
    name: "PHQ-9 ≥15",
    zone: "orange",
    category: "psychological",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      gte(latestFortnightly?.phq9_total ?? 0, PSY.phq9_orange_threshold),
    recommendation: "Urgent psychological support; assess suicide risk.",
    recommendationZh: "紧急心理支持；评估自杀风险。",
    suggestedLevers: ["psychological.psychology", "psychological.medication"],
  },
  {
    id: "gad7_moderate_yellow",
    name: "GAD-7 ≥10",
    zone: "yellow",
    category: "psychological",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      inBand(
        latestFortnightly?.gad7_total ?? 0,
        PSY.gad7_yellow_threshold,
        PSY.gad7_orange_threshold,
      ),
    recommendation: "Psychology referral; anxiety management techniques.",
    recommendationZh: "转介心理治疗；焦虑管理策略。",
    suggestedLevers: ["psychological.psychology"],
  },
  {
    id: "albumin_lt_30_yellow",
    name: "Albumin <30 g/L",
    zone: "yellow",
    category: "nutrition",
    triggersReview: true,
    evaluator: (s) => {
      const v = latestAlbumin(s);
      return v !== undefined && inBand(v, NUT.albumin_orange, NUT.albumin_yellow);
    },
    recommendation: "Nutritional intervention; check inflammatory markers.",
    recommendationZh: "营养干预；检查炎症标志物。",
    suggestedLevers: ["nutrition.dietitian", "nutrition.supplements"],
  },
  {
    id: "albumin_lt_25_orange",
    name: "Albumin <25 g/L",
    zone: "orange",
    category: "nutrition",
    triggersReview: true,
    evaluator: (s) => {
      const v = latestAlbumin(s);
      return v !== undefined && lt(v, NUT.albumin_orange);
    },
    recommendation: "Severe hypoalbuminaemia; urgent nutrition and cause review.",
    recommendationZh: "严重低白蛋白血症；紧急营养和病因评估。",
    suggestedLevers: ["nutrition.feeding_tube", "nutrition.dietitian"],
  },
  {
    id: "sarc_f_positive_yellow",
    name: "SARC-F ≥ 4 (sarcopenia screen positive)",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      gte(latestFortnightly?.sarc_f_total ?? 0, FN.sarc_f_yellow_total),
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
  },
  {
    id: "tug_gt_14_yellow",
    name: "Timed Up-and-Go > 14 s",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      (latestFortnightly?.tug_seconds ?? 0) > FN.tug_yellow_seconds,
    recommendation:
      "Elevated fall risk. Exercise physiology referral; review home fall hazards.",
    recommendationZh: "跌倒风险升高。转介运动生理学家；排查居家跌倒隐患。",
    suggestedLevers: ["physical.exercise_phys", "physical.resistance"],
  },
  {
    id: "sts_5x_gt_15_yellow",
    name: "5× sit-to-stand > 15 s",
    zone: "yellow",
    category: "function",
    triggersReview: true,
    evaluator: ({ latestFortnightly }) =>
      (latestFortnightly?.sts_5x_seconds ?? 0) > FN.sts_5x_yellow_seconds,
    recommendation:
      "Lower-body strength low. Resistance training 2–3×/week, oncology exercise physiology referral.",
    recommendationZh:
      "下肢力量低。每周 2–3 次抗阻训练，转介肿瘤运动生理学家。",
    suggestedLevers: ["physical.resistance", "physical.exercise_phys"],
  },
  {
    id: "stool_blood_red",
    name: "Visible blood or black stool",
    zone: "red",
    category: "disease",
    triggersReview: true,
    evaluator: ({ latestDaily }) =>
      latestDaily?.stool_blood === true ||
      latestDaily?.stool_color === "black" ||
      latestDaily?.stool_color === "red",
    recommendation:
      "GI bleed concern — call the oncology line today. Black or red stools require same-day clinical review even if you feel well.",
    recommendationZh:
      "疑似消化道出血 —— 请于今日联系肿瘤科。黑便或鲜血便即使感觉良好也需当日就诊。",
    suggestedLevers: ["emergency.hospital", "intensity.hold"],
  },
  {
    id: "loose_stools_persistent_yellow",
    name: "Loose stools 3+ days running",
    zone: "yellow",
    category: "toxicity",
    triggersReview: true,
    evaluator: (s) =>
      loosStoolDayStreak(s, GI.loose_stool_persistent_orange_days) >=
        GI.loose_stool_persistent_yellow_days &&
      loosStoolDayStreak(s, GI.loose_stool_persistent_orange_days) <
        GI.loose_stool_persistent_orange_days,
    recommendation:
      "Persistent loose stools — review PERT (Creon) timing with fatty meals; ensure hydration and electrolytes; raise at next clinic.",
    recommendationZh:
      "持续稀便 —— 复核胰酶替代治疗（Creon）与高脂餐的服用时机；确保补液与电解质；下次就诊时提出。",
    suggestedLevers: ["supportive.pert", "nutrition.dietitian"],
  },
  {
    id: "loose_stools_persistent_orange",
    name: "Loose stools 5+ days running",
    zone: "orange",
    category: "toxicity",
    triggersReview: true,
    evaluator: (s) =>
      loosStoolDayStreak(s, GI.loose_stool_persistent_orange_days * 2) >=
      GI.loose_stool_persistent_orange_days,
    recommendation:
      "Diarrhoea now sustained — call the oncology line for advice on loperamide and fluids. Risk of dehydration, electrolyte loss, and PERT-titration failure.",
    recommendationZh:
      "腹泻持续较久 —— 请联系肿瘤科咨询洛哌丁胺与补液方案。需警惕脱水、电解质紊乱及胰酶替代未达标。",
    suggestedLevers: ["emergency.hospital", "supportive.pert"],
  },
  {
    id: "stool_count_orange",
    name: "≥7 bowel motions in a day",
    zone: "orange",
    category: "toxicity",
    triggersReview: true,
    evaluator: ({ latestDaily }) => {
      const a = latestDaily?.stool_count ?? 0;
      const b = latestDaily?.diarrhoea_count ?? 0;
      return Math.max(a, b) >= GI.stool_count_orange;
    },
    recommendation:
      "High-volume diarrhoea (CTCAE grade 2+ territory) — call the oncology line today; assume risk of dehydration and reduced PERT/oral-medication absorption.",
    recommendationZh:
      "大量腹泻（CTCAE ≥ 2 级）—— 请于今日联系肿瘤科；考虑脱水及胰酶/口服药吸收下降的风险。",
    suggestedLevers: ["emergency.hospital", "intensity.hold"],
  },
  {
    id: "steatorrhoea_with_loose_yellow",
    name: "Oily / floating stools with loose form",
    zone: "yellow",
    category: "nutrition",
    triggersReview: true,
    evaluator: ({ latestDaily }) => {
      const oily =
        latestDaily?.stool_oil === true || latestDaily?.steatorrhoea === true;
      const loose =
        (typeof latestDaily?.stool_bristol === "number" &&
          latestDaily.stool_bristol >= GI.loose_stool_bristol_min) ||
        (typeof latestDaily?.stool_count === "number" &&
          latestDaily.stool_count >= GI.stool_count_yellow);
      return oily && loose;
    },
    recommendation:
      "Steatorrhoea pattern — PERT (Creon) is likely under-dosed for today's fat intake. Confirm dose was taken with the meal, not before or after; raise titration at next clinic.",
    recommendationZh:
      "脂肪泻表现 —— 当前胰酶替代治疗（Creon）剂量可能不足。请确认与餐同服，下次就诊时讨论加量。",
    suggestedLevers: ["supportive.pert", "nutrition.dietitian"],
  },
  {
    id: "constipation_persistent_yellow",
    name: "Constipation 3+ days running",
    zone: "yellow",
    category: "toxicity",
    triggersReview: true,
    evaluator: (s) =>
      constipationDayStreak(s, GI.constipation_yellow_days * 2) >=
      GI.constipation_yellow_days,
    recommendation:
      "Constipation building — common with anti-emetics and opioids. Increase fluids, gentle movement, and review the bowel-care plan with the team if no movement in another day.",
    recommendationZh:
      "便秘持续累积 —— 止吐药与镇痛药常见副作用。增加饮水、温和活动；若再无排便请与团队复核肠道方案。",
    suggestedLevers: ["supportive.laxative", "physical.walking"],
  },
  {
    id: "pending_result_stale_yellow",
    name: "Pending result / scan overdue",
    zone: "yellow",
    category: "disease",
    triggersReview: true,
    evaluator: ({ openPendingResults, now }) =>
      openPendingResults.some((p) => {
        if (p.received) return false;
        const expectedByMs = p.expected_by
          ? Date.parse(p.expected_by)
          : Date.parse(p.ordered_date) +
            DIS.pending_result_default_days * MS_PER_DAY;
        return !Number.isNaN(expectedByMs) && now.getTime() - expectedByMs > 0;
      }),
    recommendation:
      "One or more ordered tests or referrals are overdue. Chase the site or the ordering clinician to confirm results or next appointment.",
    recommendationZh:
      "有已预约但尚未出结果的检查 / 转诊超期。请与相关机构或医师核实进展。",
    suggestedLevers: ["monitoring.imaging_early"],
  },
];
