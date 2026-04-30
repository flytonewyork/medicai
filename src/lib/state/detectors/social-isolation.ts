// Social isolation detector — daily cadence, external axis.
//
// Detection shape: 7-day rolling mean of meaningful_interactions ≥ 40%
// below a 14-day reference window ending 14 days ago, for ≥ 5 consecutive
// days. Social drift is one of the most actionable external-axis signals
// — it tracks the patient's support-network engagement independent of
// disease or toxicity.
import {
  consecutiveDaysBelow,
  rollingMean,
} from "../variance";
import { rollingBaseline, preferredBaseline } from "../baselines";
import {
  metricAtLeast,
  metricAtMost,
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
import { isoWeekKey, shiftIsoDays as shiftDays } from "~/lib/utils/date";

const DETECTOR_ID = "social_isolation";
const METRIC_ID = "meaningful_interactions";

const ROLLING_WINDOW_DAYS = 7;
const MIN_OBSERVATIONS_FOR_BASELINE = 7;
const CAUTION_PCT = 30;
const WARNING_PCT = 50;
const MIN_DURATION_DAYS = 5;
const RESOLVED_WITHIN_PCT = 10;

const CAUSES: readonly CandidateCause[] = [
  {
    id: "carer_absence",
    label: {
      en: "Carer / family absence",
      zh: "照顾者 / 家人不在身边",
    },
    explanation: {
      en: "Low carer-present days alongside low interactions suggests the primary support structure has drifted. Worth flagging family / rota discussion.",
      zh: "照顾者在场率下降与互动减少同时出现，提示主要支持结构发生变化。建议与家人讨论排班。",
    },
    required_supporters: 1,
    predicates: [
      metricAtMost("carer_present_flag", 0),
      metricDriftingAgainst("carer_present_flag", "lower", 25),
    ],
  },
  {
    id: "chemo_exhaustion",
    label: {
      en: "Chemo exhaustion limiting contact",
      zh: "化疗疲惫影响社交",
    },
    explanation: {
      en: "Low energy + low mood alongside reduced interactions often means the patient is too tired to engage rather than socially disconnected. Shifting toward shorter visits or phone calls can help.",
      zh: "精力与情绪同时下降伴随互动减少，常反映患者太累而非断联。可改为短暂探访或电话。",
    },
    required_supporters: 2,
    predicates: [
      metricDriftingAgainst("energy", "lower", 20),
      metricDriftingAgainst("mood_clarity", "lower", 20),
      metricAtLeast("nausea", 4),
    ],
  },
  {
    id: "mood_withdrawal",
    label: {
      en: "Mood-driven withdrawal",
      zh: "情绪性回避社交",
    },
    explanation: {
      en: "Low mood + sleep decline alongside low interactions is the depression-withdrawal pattern. Psychology referral is the highest-yield intervention.",
      zh: "情绪低落、睡眠下降与互动减少 —— 抑郁性回避模式。转介心理学是最高产出干预。",
    },
    required_supporters: 2,
    predicates: [
      metricDriftingAgainst("mood_clarity", "lower", 20),
      metricDriftingAgainst("sleep_quality", "lower", 20),
    ],
  },
  {
    id: "routine_drift",
    label: {
      en: "Routine drift — no obvious driver",
      zh: "生活节奏漂移 —— 无明显原因",
    },
    explanation: {
      en: "No concurrent drivers stand out. A single scheduled family visit or call can reset the trend before it becomes entrenched.",
      zh: "无明显并发驱动因素。一次安排好的探访或电话可以在趋势变深前重置。",
    },
    predicates: [],
  },
];

function actionsForCause(causeId: string): SuggestedAction[] {
  switch (causeId) {
    case "carer_absence":
      return [
        {
          kind: "conversation",
          ref_id: "family_rota_discussion",
          urgency: "soon",
          label: {
            en: "Check in with family about carer rota",
            zh: "与家人讨论照顾者排班",
          },
        },
        {
          kind: "lever",
          ref_id: "community.support_services",
          urgency: "soon",
          label: {
            en: "Community nurse / support referral",
            zh: "社区护理 / 支援转介",
          },
        },
      ];
    case "chemo_exhaustion":
      return [
        {
          kind: "self",
          ref_id: "short_visit_preference",
          urgency: "now",
          label: {
            en: "Switch to short visits or calls this week",
            zh: "本周改为短暂探访或通话",
          },
        },
        {
          kind: "conversation",
          ref_id: "family_pace_update",
          urgency: "soon",
          label: {
            en: "Update family about current energy level",
            zh: "向家人说明当前精力状况",
          },
        },
      ];
    case "mood_withdrawal":
      return [
        {
          kind: "lever",
          ref_id: "psychological.psychology",
          urgency: "soon",
          label: {
            en: "Psychology referral",
            zh: "心理学转介",
          },
        },
        {
          kind: "self",
          ref_id: "one_planned_contact",
          urgency: "now",
          label: {
            en: "Plan one specific contact this week",
            zh: "本周安排一次具体的联系",
          },
        },
      ];
    case "routine_drift":
    default:
      return [
        {
          kind: "self",
          ref_id: "one_planned_contact",
          urgency: "now",
          label: {
            en: "Schedule one call or visit this week",
            zh: "本周安排一次通话或探访",
          },
        },
      ];
  }
}

export const socialIsolationDetector: Detector = {
  id: DETECTOR_ID,

  evaluate(ctx: DetectorContext): ChangeSignal[] {
    const trajectory = ctx.state.metrics[METRIC_ID];
    const obs = ctx.observations[METRIC_ID] ?? [];
    if (
      !trajectory ||
      !trajectory.fresh ||
      obs.length < MIN_OBSERVATIONS_FOR_BASELINE
    ) {
      return [];
    }

    const referenceAsOf = shiftDays(ctx.now, -14).slice(0, 10);
    const referenceBaseline = rollingBaseline(obs, referenceAsOf, 14, 5);
    const preferred = preferredBaseline(trajectory.baselines);
    const baseline = referenceBaseline ?? preferred;
    if (!baseline || typeof baseline.value !== "number" || baseline.value <= 0) {
      return [];
    }
    const baselineValue = baseline.value;
    const cautionThreshold = baselineValue * (1 - CAUTION_PCT / 100);
    const warningThreshold = baselineValue * (1 - WARNING_PCT / 100);

    const currentMean = rollingMean(obs, ctx.now, ROLLING_WINDOW_DAYS);
    if (currentMean == null || currentMean >= cautionThreshold) return [];

    const duration = consecutiveDaysBelow(
      obs,
      ctx.now,
      ROLLING_WINDOW_DAYS,
      cautionThreshold,
    );
    if (duration < MIN_DURATION_DAYS) return [];

    const severity = currentMean <= warningThreshold ? "warning" : "caution";

    const evidence: SignalEvidence = {
      baseline_value: Math.round(baselineValue * 10) / 10,
      baseline_kind: baseline.kind,
      current_value: Math.round(currentMean * 10) / 10,
      delta_abs: Math.round((currentMean - baselineValue) * 10) / 10,
      sd_units: 0,
      duration_days: duration,
    };

    const differential = rankDifferential(ctx.state, CAUSES);
    const topCause =
      differential.find((d) => d.confidence !== "unlikely") ??
      differential[0];
    const actions = topCause ? actionsForCause(topCause.id) : [];

    const fired_for = `${DETECTOR_ID}:${isoWeekKey(ctx.now)}`;
    const title =
      severity === "warning"
        ? {
            en: `Social contact has halved (${evidence.current_value} vs ${evidence.baseline_value}/day)`,
            zh: `社交联系减半（当前 ${evidence.current_value}，基线 ${evidence.baseline_value} 每日）`,
          }
        : {
            en: `Social contact drifting down (${evidence.current_value} vs ${evidence.baseline_value}/day)`,
            zh: `社交联系下降（当前 ${evidence.current_value}，基线 ${evidence.baseline_value} 每日）`,
          };

    const explanation = {
      en: "Social connectedness is the external-axis signal with the most direct link to mood + motivation. Even one scheduled contact resets the trajectory.",
      zh: "社交连接是外部维度中与情绪 / 动力最直接相关的信号。哪怕一次计划好的联系也能扭转趋势。",
    };

    return [
      {
        detector: DETECTOR_ID,
        fired_for,
        metric_id: METRIC_ID,
        axis: "external",
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
    const trajectory = ctx.state.metrics[METRIC_ID];
    const obs = ctx.observations[METRIC_ID] ?? [];
    if (
      !trajectory ||
      !trajectory.fresh ||
      obs.length < MIN_OBSERVATIONS_FOR_BASELINE
    ) {
      return false;
    }
    const referenceAsOf = shiftDays(ctx.now, -14).slice(0, 10);
    const referenceBaseline = rollingBaseline(obs, referenceAsOf, 14, 5);
    const preferred = preferredBaseline(trajectory.baselines);
    const baseline = referenceBaseline ?? preferred;
    if (!baseline || typeof baseline.value !== "number" || baseline.value <= 0) {
      return false;
    }
    const currentMean = rollingMean(obs, ctx.now, ROLLING_WINDOW_DAYS);
    if (currentMean == null) return false;
    return currentMean >= baseline.value * (1 - RESOLVED_WITHIN_PCT / 100);
  },
};

export const _internals = { CAUSES, actionsForCause, DETECTOR_ID, METRIC_ID };
