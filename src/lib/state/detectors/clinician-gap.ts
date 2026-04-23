// Clinician-gap detector — event-driven cadence, external axis.
//
// Detection shape: days since the most recent care-team touchpoint exceeds
// an intensity-calibrated threshold. During active chemotherapy, contact
// gaps > 14 days are anomalous; during maintenance > 28 days is the
// threshold. The detector reads `care_team_contacts` directly from the
// DetectorContext because the metric-registry / trajectory shape (rolling
// means over continuous observations) doesn't fit event-driven data.
import { rankDifferential, type CandidateCause } from "./differential";
import type {
  ChangeSignal,
  Detector,
  DetectorContext,
  SignalEvidence,
  SuggestedAction,
} from "./types";

const DETECTOR_ID = "clinician_gap";

const DAYS_MS = 86_400_000;

// Cycle-active thresholds (in days since last touchpoint).
const ACTIVE_CAUTION_DAYS = 14;
const ACTIVE_WARNING_DAYS = 21;
// Maintenance / off-cycle thresholds.
const MAINT_CAUTION_DAYS = 28;
const MAINT_WARNING_DAYS = 42;

const CAUSES: readonly CandidateCause[] = [
  {
    id: "scheduling_gap",
    label: {
      en: "Scheduling gap",
      zh: "排期间隙",
    },
    explanation: {
      en: "Normal follow-up appears to have slipped — not a clinical issue, but the loop breaks without touchpoints. One call or email re-establishes it.",
      zh: "常规随访似乎被错过 —— 并非临床问题，但缺乏接触会中断沟通闭环。一次电话或邮件即可重建。",
    },
    predicates: [],
  },
];

function actionsForSeverity(
  severity: "caution" | "warning",
): SuggestedAction[] {
  const baseline: SuggestedAction[] = [
    {
      kind: "task",
      ref_id: "book_clinic_review",
      urgency: severity === "warning" ? "now" : "soon",
      label: {
        en: "Book next clinic review",
        zh: "预约下次门诊",
      },
    },
    {
      kind: "self",
      ref_id: "call_oncology_team",
      urgency: severity === "warning" ? "now" : "soon",
      label: {
        en: "Call the oncology team to confirm plan",
        zh: "致电肿瘤团队确认方案",
      },
    },
  ];
  return baseline;
}

function latestContact(
  contacts: readonly { date: string }[],
  nowISO: string,
): { latest?: string; days_since: number | null } {
  if (contacts.length === 0) return { days_since: null };
  const nowMs = Date.parse(nowISO);
  const dates = contacts
    .map((c) => Date.parse(c.date))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  const latest = dates[0];
  if (latest == null) return { days_since: null };
  const daysSince = Math.floor((nowMs - latest) / DAYS_MS);
  return {
    latest: new Date(latest).toISOString().slice(0, 10),
    days_since: daysSince,
  };
}

function fortnightKey(iso: string): string {
  // Two-week dedup window — if a gap persists for longer than a fortnight
  // a fresh signal should fire (the situation materially worsened).
  const d = new Date(iso);
  const days = Math.floor(d.valueOf() / DAYS_MS);
  const fortnight = Math.floor(days / 14);
  return `${DETECTOR_ID}:F${fortnight}`;
}

export const clinicianGapDetector: Detector = {
  id: DETECTOR_ID,

  evaluate(ctx: DetectorContext): ChangeSignal[] {
    const contacts = ctx.care_team_contacts ?? [];
    const cycleActive = !!ctx.state.cycle;
    const cautionDays = cycleActive ? ACTIVE_CAUTION_DAYS : MAINT_CAUTION_DAYS;
    const warningDays = cycleActive ? ACTIVE_WARNING_DAYS : MAINT_WARNING_DAYS;

    const { latest, days_since } = latestContact(contacts, ctx.now);
    if (days_since == null) return [];              // no contact log yet
    if (days_since < cautionDays) return [];

    const severity = days_since >= warningDays ? "warning" : "caution";

    const evidence: SignalEvidence = {
      baseline_value: cautionDays,
      baseline_kind: cycleActive ? "fixed" : "fixed",
      current_value: days_since,
      delta_abs: days_since - cautionDays,
      sd_units: 0,
      duration_days: days_since,
    };

    const differential = rankDifferential(ctx.state, CAUSES);
    const fired_for = fortnightKey(ctx.now);

    const title =
      severity === "warning"
        ? {
            en: `${days_since} days since a care-team contact — book now`,
            zh: `已 ${days_since} 天未与医疗团队联系 —— 立即预约`,
          }
        : {
            en: `${days_since} days since last care-team contact`,
            zh: `距上次医疗团队接触已 ${days_since} 天`,
          };
    const explanation = cycleActive
      ? {
          en: `Active treatment cycles warrant touchpoints at least every ${cautionDays} days. Latest contact: ${latest ?? "—"}.`,
          zh: `正在治疗周期期间，每 ${cautionDays} 天至少应有一次接触。最近接触：${latest ?? "—"}。`,
        }
      : {
          en: `Maintenance follow-up rhythm is every ${cautionDays}–${warningDays} days. Latest contact: ${latest ?? "—"}.`,
          zh: `维持期随访节奏约为每 ${cautionDays}–${warningDays} 天一次。最近接触：${latest ?? "—"}。`,
        };

    return [
      {
        detector: DETECTOR_ID,
        fired_for,
        metric_id: "days_since_clinician_touchpoint",
        axis: "external",
        shape: "rolling_drift",
        severity,
        title,
        explanation,
        evidence,
        differential,
        actions: actionsForSeverity(severity),
      },
    ];
  },

  hasResolved(signal, ctx) {
    if (signal.detector !== DETECTOR_ID) return false;
    const contacts = ctx.care_team_contacts ?? [];
    const cycleActive = !!ctx.state.cycle;
    const cautionDays = cycleActive ? ACTIVE_CAUTION_DAYS : MAINT_CAUTION_DAYS;
    const { days_since } = latestContact(contacts, ctx.now);
    if (days_since == null) return false;
    return days_since < cautionDays;
  },
};

export const _internals = {
  DETECTOR_ID,
  ACTIVE_CAUTION_DAYS,
  ACTIVE_WARNING_DAYS,
  MAINT_CAUTION_DAYS,
  MAINT_WARNING_DAYS,
  latestContact,
};
