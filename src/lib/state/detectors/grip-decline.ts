// Grip strength decline detector — fortnightly cadence, individual axis.
//
// Grip is the highest-yield objective muscle measurement available in the
// schema. It's measured every two weeks (FortnightlyAssessment), which means
// rolling-window techniques don't apply — we reason over the last 3-4
// fortnightly observations via OLS slope and cycle-matched deltas.
//
// Detection shape: slope across the last ≥3 fortnightlies is more negative
// than −0.3 kg / week (i.e. ≈ −0.6 kg / fortnight), OR the most recent point
// is ≥ 15% below pre-diagnosis baseline and slope is negative. Zone rules
// already fire at 10% (yellow) and 20% (orange) absolute decline — this
// detector is the *trend* signal that precedes the threshold crossing.
import { olsSlopePerDay } from "../slope";
import { preferredBaseline } from "../baselines";
import {
  metricAtLeast,
  metricDriftingAgainst,
  rankDifferential,
  type CandidateCause,
} from "./differential";
import type {
  ChangeSignal,
  Detector,
  DetectorContext,
  SignalEvidence,
  SuggestedAction,
} from "./types";

const DETECTOR_ID = "grip_decline";
const METRIC_ID = "grip_dominant_kg";

// Thresholds
const MIN_OBSERVATIONS = 3;
// −0.3 kg/week corresponds to ≈ 15% annual decline from a 40 kg baseline —
// well above age-related attrition (0.05 kg/week) so this is a signal not noise.
const CAUTION_SLOPE_PER_DAY = -0.3 / 7;
const WARNING_SLOPE_PER_DAY = -0.6 / 7;
const CAUTION_PCT_BELOW_BASELINE = 7; // 7% below baseline + negative slope
const WARNING_PCT_BELOW_BASELINE = 12;
const RESOLVED_SLOPE_PER_DAY = -0.1 / 7; // nearly flat or recovering

const CAUSES: readonly CandidateCause[] = [
  {
    id: "chemo_neurotoxicity",
    label: {
      en: "Chemo-induced neuropathy affecting grip",
      zh: "化疗诱导的神经病变影响握力",
    },
    explanation: {
      en: "Grip decline with concurrent hand neuropathy flags suggests peripheral toxicity is the mechanism. Discuss dose modification and duloxetine with Dr Lee.",
      zh: "握力下降伴手部神经病变提示周围神经毒性是机制。可与 Dr Lee 讨论剂量调整和度洛西汀。",
    },
    required_supporters: 1,
    predicates: [
      metricAtLeast("neuropathy_hands_flag", 1),
      metricAtLeast("neuropathy_grade", 2),
    ],
  },
  {
    id: "cachexia",
    label: {
      en: "Cachexia / sarcopenia drift",
      zh: "恶病质 / 肌少症漂移",
    },
    explanation: {
      en: "Grip decline alongside weight loss and low protein intake is the cachexia pattern. The intervention set is nutrition + resistance — it's time-sensitive once muscle starts going.",
      zh: "握力下降伴体重下降和低蛋白摄入提示恶病质。干预方案为营养 + 抗阻训练 —— 一旦肌肉开始流失，时间窗很紧。",
    },
    required_supporters: 1,
    predicates: [
      metricDriftingAgainst("weight_kg", "lower", 3),
      metricDriftingAgainst("protein_grams", "lower", 25),
      metricDriftingAgainst("albumin", "lower", 10),
    ],
  },
  {
    id: "deconditioning_only",
    label: {
      en: "Isolated deconditioning",
      zh: "单一去适应",
    },
    explanation: {
      en: "No concurrent toxicity or cachexia markers — grip decline looks like lost training stimulus. Exercise physiology + resistance program is the direct lever.",
      zh: "无伴随毒性或恶病质标志 —— 握力下降提示缺乏训练刺激。运动生理学 + 抗阻训练为直接干预。",
    },
    required_supporters: 1,
    predicates: [
      metricDriftingAgainst("walking_minutes", "lower", 30),
      metricDriftingAgainst("steps", "lower", 20),
    ],
  },
  {
    id: "unknown",
    label: {
      en: "Mechanism unclear",
      zh: "机制不明",
    },
    explanation: {
      en: "Grip declining without concurrent signals. Worth confirming with a manual retest + raising at next clinic visit.",
      zh: "握力下降但无并发信号。建议重测确认并在下次就诊时提出。",
    },
    predicates: [],
  },
];

function actionsForCause(causeId: string): SuggestedAction[] {
  switch (causeId) {
    case "chemo_neurotoxicity":
      return [
        {
          kind: "question",
          ref_id: "dose_modification_review",
          urgency: "next_visit",
          label: {
            en: "Discuss dose modification to protect grip",
            zh: "讨论剂量调整以保护握力",
          },
        },
        {
          kind: "lever",
          ref_id: "supportive.duloxetine",
          urgency: "soon",
          label: {
            en: "Start duloxetine 30–60 mg",
            zh: "开始度洛西汀 30–60 mg",
          },
        },
      ];
    case "cachexia":
      return [
        {
          kind: "lever",
          ref_id: "nutrition.dietitian",
          urgency: "soon",
          label: {
            en: "Oncology dietitian referral",
            zh: "肿瘤营养师转介",
          },
        },
        {
          kind: "lever",
          ref_id: "physical.resistance",
          urgency: "now",
          label: {
            en: "Resistance training 2–3×/week",
            zh: "每周 2–3 次抗阻训练",
          },
        },
        {
          kind: "lever",
          ref_id: "nutrition.supplements",
          urgency: "now",
          label: {
            en: "Add protein supplement between meals",
            zh: "餐间加蛋白补充",
          },
        },
      ];
    case "deconditioning_only":
      return [
        {
          kind: "lever",
          ref_id: "physical.exercise_phys",
          urgency: "soon",
          label: {
            en: "Exercise physiology referral",
            zh: "运动生理学转介",
          },
        },
        {
          kind: "lever",
          ref_id: "physical.resistance",
          urgency: "now",
          label: {
            en: "Resistance training 2–3×/week",
            zh: "每周 2–3 次抗阻训练",
          },
        },
      ];
    default:
      return [
        {
          kind: "task",
          ref_id: "grip_retest",
          urgency: "soon",
          label: {
            en: "Repeat grip test in 48h to confirm",
            zh: "48 小时内重测握力确认",
          },
        },
        {
          kind: "question",
          ref_id: "grip_concern",
          urgency: "next_visit",
          label: {
            en: "Raise grip trend at next clinic visit",
            zh: "下次就诊提及握力趋势",
          },
        },
      ];
  }
}

// One signal per fortnightly assessment that triggers the detector. Dedup
// key: the ISO date of the most recent assessment that produced the data.
function firedForKey(latestAssessmentDate: string): string {
  return `${DETECTOR_ID}:${latestAssessmentDate}`;
}

function currentSlope(
  observations: readonly { date: string; value: number }[],
): { slope: number | null; latest?: { date: string; value: number } } {
  if (observations.length < MIN_OBSERVATIONS) return { slope: null };
  const latest = observations[observations.length - 1];
  // Use only the most recent MIN_OBSERVATIONS+1 points so an old stable period
  // doesn't mask a new decline.
  const window = observations.slice(-4);
  return { slope: olsSlopePerDay(window), latest };
}

export const gripDeclineDetector: Detector = {
  id: DETECTOR_ID,

  evaluate(ctx: DetectorContext): ChangeSignal[] {
    const trajectory = ctx.state.metrics[METRIC_ID];
    const obs = ctx.observations[METRIC_ID] ?? [];
    if (!trajectory || !trajectory.fresh || obs.length < MIN_OBSERVATIONS) return [];

    const { slope, latest } = currentSlope(obs);
    if (slope == null || !latest) return [];
    if (slope > CAUTION_SLOPE_PER_DAY) return []; // not declining meaningfully

    const baseline = preferredBaseline(trajectory.baselines);
    const baselineValue = baseline?.value;
    const pctBelow =
      typeof baselineValue === "number" && baselineValue > 0
        ? ((baselineValue - latest.value) / baselineValue) * 100
        : undefined;

    // Require either a meaningfully negative slope OR meaningful pct-below
    // baseline to fire. This filters noise from a single low reading.
    const slopeCaution = slope <= CAUTION_SLOPE_PER_DAY;
    const slopeWarning = slope <= WARNING_SLOPE_PER_DAY;
    const pctCaution =
      typeof pctBelow === "number" && pctBelow >= CAUTION_PCT_BELOW_BASELINE;
    const pctWarning =
      typeof pctBelow === "number" && pctBelow >= WARNING_PCT_BELOW_BASELINE;

    if (!slopeCaution && !pctCaution) return [];

    const severity = slopeWarning || pctWarning ? "warning" : "caution";

    const evidence: SignalEvidence = {
      baseline_value: Math.round((baselineValue ?? latest.value) * 10) / 10,
      baseline_kind: baseline?.kind ?? "pre_diagnosis",
      current_value: Math.round(latest.value * 10) / 10,
      delta_abs:
        typeof baselineValue === "number"
          ? Math.round((latest.value - baselineValue) * 10) / 10
          : 0,
      sd_units: 0, // fortnightly cadence lacks reliable patient-SD estimate
      duration_days: obs.length >= 2
        ? daysBetween(obs[0]!.date, latest.date)
        : 0,
      slope_recent: slope,
    };

    const differential = rankDifferential(ctx.state, CAUSES);
    // For unknown, ensure it's last if anything else is at least "possible".
    const topCause =
      differential.find((d) => d.confidence !== "unlikely" && d.id !== "unknown") ??
      differential[0];
    const actions = topCause ? actionsForCause(topCause.id) : [];

    const fired_for = firedForKey(latest.date);
    const kgPerFortnight = (slope * 14).toFixed(1);
    const title =
      severity === "warning"
        ? {
            en: `Grip strength falling fast (${kgPerFortnight} kg / fortnight)`,
            zh: `握力下降较快（${kgPerFortnight} 公斤 / 两周）`,
          }
        : {
            en: `Grip strength trend turning down`,
            zh: `握力趋势转为下降`,
          };

    const explanation = {
      en: "Grip is the most sensitive muscle signal available day-to-day and directly predicts functional reserve for trial eligibility. Detector fires before the zone-rule threshold so a conversation can start early.",
      zh: "握力是日常可得的最敏感肌肉信号，直接预测功能储备与入组资格。在区带规则阈值前触发以便及早讨论。",
    };

    return [
      {
        detector: DETECTOR_ID,
        fired_for,
        metric_id: METRIC_ID,
        axis: "individual",
        shape: "rolling_drift",
        severity,
        title,
        explanation,
        evidence,
        differential,
        actions,
      },
    ];
  },

  hasResolved(signal, ctx) {
    if (signal.detector !== DETECTOR_ID) return false;
    const obs = ctx.observations[METRIC_ID] ?? [];
    if (obs.length < MIN_OBSERVATIONS) return false;
    const { slope } = currentSlope(obs);
    if (slope == null) return false;
    return slope >= RESOLVED_SLOPE_PER_DAY;
  },
};

function daysBetween(startISO: string, endISO: string): number {
  const s = Date.parse(startISO);
  const e = Date.parse(endISO);
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

export const _internals = {
  CAUSES,
  actionsForCause,
  DETECTOR_ID,
  METRIC_ID,
  CAUTION_SLOPE_PER_DAY,
  WARNING_SLOPE_PER_DAY,
};
