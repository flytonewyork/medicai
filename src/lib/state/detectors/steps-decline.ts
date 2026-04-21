// Steps decline detector — daily cadence, individual axis.
//
// Detection shape: the 7-day rolling mean of steps has been ≥ k patient-SDs
// below the preferred baseline for ≥ 5 consecutive days. Step count is a
// high-frequency objective proxy for functional performance and ECOG PS —
// it typically falls weeks before clinician-rated PS change.
//
// Multi-dimensional differential: concurrent metrics across all four axes
// are inspected to rank likely causes. The signal surfaces the ranked
// differential and the supporting metric ids so the reasoning is auditable.
import {
  consecutiveDaysBelow,
  patientSD,
  rollingMean,
} from "../variance";
import { slopeOver } from "../slope";
import { preferredBaseline, rollingBaseline } from "../baselines";
import {
  cycleDayBetween,
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

const DETECTOR_ID = "steps_decline";
const METRIC_ID = "steps";

// Thresholds — at module top for easy audit.
//
// Firing uses percent-below-baseline: a 7-day rolling mean that has fallen
// ≥ CAUTION_PCT below the preferred baseline for ≥ MIN_DURATION_DAYS.
// Percent is more robust than SD-units here: when a patient starts drifting,
// the 28-day SD window ends up containing both the stable period and the
// drift, which inflates the SD and hides the signal. We still surface
// sd_units in the evidence as a secondary descriptor — computed from the
// variance of baseline-only days when identifiable.
const ROLLING_WINDOW_DAYS = 7;
const BASELINE_WINDOW_DAYS = 28;
const MIN_OBSERVATIONS_FOR_BASELINE = 7;
// Firing thresholds are deliberately tight (10% / 20%) because the rolling_28d
// baseline is self-contaminated once drift begins — the current drop is
// already pulling the baseline mean down, so the apparent pct_below_baseline
// is smaller than the true pct-below-pre-drift. A future slice will add
// robust "pre-drift reference" baselines; until then, tight thresholds keep
// the detector usable.
const CAUTION_PCT = 10;
const WARNING_PCT = 20;
const MIN_DURATION_DAYS = 5;
const RESOLVED_WITHIN_PCT = 5; // 7-day mean within 5% of baseline ⇒ resolved

const CAUSES: readonly CandidateCause[] = [
  {
    id: "chemo_recovery",
    label: {
      en: "Expected chemo-week recovery",
      zh: "化疗后恢复期（预期）",
    },
    explanation: {
      en: "Activity dips across days 2–7 of each GnP cycle are normal. Re-check at D8+.",
      zh: "GnP 周期第 2–7 天活动下降属预期范围。第 8 天后复评。",
    },
    required_supporters: 2,
    predicates: [
      cycleDayBetween(2, 7),
      metricAtLeast("nausea", 4),
      metricAtMost("appetite", 4),
      metricAtMost("energy", 4),
    ],
  },
  {
    id: "disease_progression",
    label: {
      en: "Possible disease progression pattern",
      zh: "可能的疾病进展模式",
    },
    explanation: {
      en: "Rising pain or new dyspnoea alongside activity decline is the pattern that most often precedes scan-confirmed progression. Worth raising early imaging with Dr Lee.",
      zh: "疼痛上升或新发呼吸困难与活动量下降同时出现，最常在影像进展前出现。考虑提前与 Dr Lee 讨论影像。",
    },
    required_supporters: 1,
    predicates: [
      metricDriftingAgainst("pain_current", "higher", 20),
      metricDriftingAgainst("pain_worst", "higher", 20),
      metricAtLeast("dyspnoea_flag", 1),
    ],
  },
  {
    id: "mood_depression",
    label: {
      en: "Mood / motivation shift",
      zh: "情绪 / 动力下降",
    },
    explanation: {
      en: "Low mood with reduced sleep quality can present as activity decline before it shows on PHQ-9. Surface early; psychology referral is the highest-yield intervention.",
      zh: "情绪低落与睡眠质量下降可在 PHQ-9 反映之前以活动量下降方式出现。转介心理学可早期介入。",
    },
    required_supporters: 2,
    predicates: [
      metricDriftingAgainst("mood_clarity", "lower", 20),
      metricDriftingAgainst("sleep_quality", "lower", 20),
      metricDriftingAgainst("energy", "lower", 20),
    ],
  },
  {
    id: "toxicity_burden",
    label: {
      en: "Rising treatment toxicity",
      zh: "治疗毒性累积",
    },
    explanation: {
      en: "Neuropathy or persistent nausea can cause activity decline by making movement harder or nauseating. Dose modification is the lever to discuss.",
      zh: "神经病变或持续恶心可通过使活动更困难或引发恶心而导致活动下降。可与医师讨论剂量调整。",
    },
    required_supporters: 1,
    predicates: [
      metricAtLeast("neuropathy_hands_flag", 1),
      metricAtLeast("neuropathy_feet_flag", 1),
      metricDriftingAgainst("nausea", "higher", 20),
    ],
  },
  {
    id: "deconditioning",
    label: {
      en: "Deconditioning / sarcopenia drift",
      zh: "去适应 / 肌少症漂移",
    },
    explanation: {
      en: "Isolated activity decline — no concurrent symptoms — suggests deconditioning. Resistance training + exercise physiology is the targeted intervention.",
      zh: "单一活动下降且无伴随症状，提示去适应。抗阻训练 + 运动生理学为针对性干预。",
    },
    required_supporters: 1,
    predicates: [
      metricDriftingAgainst("grip_dominant_kg", "lower", 10),
      metricDriftingAgainst("gait_speed_ms", "lower", 10),
      metricDriftingAgainst("walking_minutes", "lower", 30),
    ],
  },
];

function actionsForCause(causeId: string): SuggestedAction[] {
  switch (causeId) {
    case "chemo_recovery":
      return [
        {
          kind: "self",
          ref_id: "gentle_walk_10min",
          urgency: "now",
          label: {
            en: "Try a gentle 10-min walk + hydrate",
            zh: "尝试温和的 10 分钟步行 + 补水",
          },
        },
        {
          kind: "conversation",
          ref_id: "carer_check_in",
          urgency: "soon",
          label: {
            en: "Check in with carer about rest plan for next 3 days",
            zh: "与照顾者沟通未来 3 天的休息计划",
          },
        },
      ];
    case "disease_progression":
      return [
        {
          kind: "question",
          ref_id: "early_imaging",
          urgency: "next_visit",
          label: {
            en: "Ask Dr Lee about bringing CT forward",
            zh: "与 Dr Lee 讨论提前 CT 影像",
          },
        },
        {
          kind: "lever",
          ref_id: "monitoring.imaging_early",
          urgency: "next_visit",
          label: {
            en: "Early imaging lever",
            zh: "提前影像干预",
          },
        },
      ];
    case "mood_depression":
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
          ref_id: "practice_prioritise",
          urgency: "now",
          label: {
            en: "Prioritise one short practice session today",
            zh: "今天优先做一次短修习",
          },
        },
      ];
    case "toxicity_burden":
      return [
        {
          kind: "question",
          ref_id: "dose_modification_review",
          urgency: "next_visit",
          label: {
            en: "Discuss dose modification with Dr Lee",
            zh: "与 Dr Lee 讨论剂量调整",
          },
        },
        {
          kind: "lever",
          ref_id: "supportive.duloxetine",
          urgency: "soon",
          label: {
            en: "Consider duloxetine for neuropathy",
            zh: "考虑度洛西汀治疗神经病变",
          },
        },
      ];
    case "deconditioning":
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
            en: "Resistance training 2-3×/week",
            zh: "每周 2–3 次抗阻训练",
          },
        },
      ];
    default:
      return [];
  }
}

// One signal per ISO week — drifts persist across days, so we dedupe at the
// week granularity. If a drift continues across a week boundary the
// following evaluation produces a fresh fired_for, which is the right
// behaviour (a persistent drift warrants a fresh surface).
function isoWeekKey(iso: string): string {
  const d = new Date(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 4),
  );
  const weekNr =
    1 +
    Math.round(
      ((target.valueOf() - firstThursday.valueOf()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(weekNr).padStart(2, "0")}`;
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export const stepsDeclineDetector: Detector = {
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

    // Prefer a reference baseline from BEFORE the current drift window so
    // the threshold isn't contaminated by the drift itself. The 14-day mean
    // ending 14 days ago gives us "what the patient was doing two weeks
    // ago." Fall back to the trajectory's preferredBaseline if reference
    // can't be computed (early in tracking, or after a long quiet period).
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

    const severity =
      currentMean <= warningThreshold ? "warning" : "caution";
    const slopeRecent = slopeOver(obs, ctx.now, 7) ?? undefined;
    const slopePrior = slopeOver(obs, shiftDays(ctx.now, -7), 7) ?? undefined;

    // SD is a secondary descriptor — best-effort. When the 28-day window
    // straddles baseline and drift it over-estimates SD; that's why the
    // firing threshold above uses percent, not SD units.
    const sd = patientSD(obs, ctx.now, BASELINE_WINDOW_DAYS, 5);
    const sdUnits = sd ? (currentMean - baselineValue) / sd.sd : 0;

    const evidence: SignalEvidence = {
      baseline_value: Math.round(baselineValue),
      baseline_kind: baseline.kind,
      current_value: Math.round(currentMean),
      delta_abs: Math.round(currentMean - baselineValue),
      sd_units: sdUnits,
      duration_days: duration,
      slope_recent: slopeRecent,
      slope_prior: slopePrior,
    };

    const differential = rankDifferential(ctx.state, CAUSES);
    const topCause = differential[0];
    const actions = topCause && topCause.confidence !== "unlikely"
      ? actionsForCause(topCause.id)
      : [];

    const fired_for = `${DETECTOR_ID}:${isoWeekKey(ctx.now)}`;
    const sdAbs = Math.abs(evidence.sd_units).toFixed(1);
    const title =
      severity === "warning"
        ? {
            en: `Daily steps down ${sdAbs} SD — worth action today`,
            zh: `每日步数下降 ${sdAbs} 个标准差 —— 今天宜采取行动`,
          }
        : {
            en: `Daily steps drifting (${evidence.current_value} vs ${evidence.baseline_value})`,
            zh: `每日步数缓慢下降（当前 ${evidence.current_value}，基线 ${evidence.baseline_value}）`,
          };
    const explanation = topCause && topCause.confidence !== "unlikely"
      ? {
          en: "Activity change combined with the signals below suggests the cause ranked most likely. Expand for supporting metrics.",
          zh: "活动变化与下列并发信号结合，提示最可能的原因。展开查看支持指标。",
        }
      : {
          en: "A sustained drop in daily activity is one of the earliest signals of drift across any axis. No single cause stands out — worth watching + logging symptoms for 3 days.",
          zh: "每日活动持续下降是各维度漂移最早的信号之一。尚无单一原因突出 —— 建议继续观察并记录症状 3 天。",
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
    const resolvedThreshold = baseline.value * (1 - RESOLVED_WITHIN_PCT / 100);
    return currentMean >= resolvedThreshold;
  },
};

export const _internals = {
  CAUSES,
  actionsForCause,
  DETECTOR_ID,
  METRIC_ID,
  CAUTION_PCT,
  WARNING_PCT,
  MIN_DURATION_DAYS,
};
