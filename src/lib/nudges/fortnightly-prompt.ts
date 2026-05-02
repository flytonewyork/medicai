import type { FeedItem } from "~/types/feed";
import type { FortnightlyAssessment } from "~/types/clinical";

// Fortnightly-assessment cadence prompt.
//
// The fortnightly form is the function-preservation backbone: grip,
// gait, ECOG, sarc-F, TUG, STS — every axis-3 metric that needs
// instrumented capture lives here. Without it, the V2 grip / gait /
// sarc-F / TUG / STS rules in `zone-rules-v2.ts` have nothing to
// score against.
//
// Phase 0 audit (docs/analytical_density_audit.md, 2026-05-02) found
// **0 fortnightly_assessments** in cloud for Hu Lin despite the app
// being live for 10+ days. Root cause: nothing in the cadence /
// nudge / task surface ever prompts him to complete one. The form
// exists, the route exists, the patient never sees a reminder.
//
// This module fills the gap. Fires when:
//   - the most recent fortnightly is missing or > 12 days old
//   - AND no red-zone alert is active (safety owns the channel)
//
// Threshold of 12 days (not 14) so Hu Lin gets the prompt before the
// fortnightly is "overdue" — gentle reminder a couple of days early
// is calmer than a "you missed this" framing.

const PROMPT_AFTER_DAYS = 12;

export interface FortnightlyPromptInputs {
  todayISO: string;
  fortnightlies: readonly FortnightlyAssessment[];
  /**
   * If any red-zone alert is active, suppress this prompt — the safety
   * channel takes priority. Default false.
   */
  redZoneActive?: boolean;
}

export function computeFortnightlyPrompt(
  inputs: FortnightlyPromptInputs,
): FeedItem[] {
  if (inputs.redZoneActive) return [];

  const todayMs = Date.parse(inputs.todayISO + "T12:00:00Z");
  if (Number.isNaN(todayMs)) return [];

  const latest = inputs.fortnightlies
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.assessment_date) - Date.parse(a.assessment_date),
    )[0];

  let daysSince: number;
  if (!latest) {
    // Never completed — strongest copy.
    daysSince = Number.POSITIVE_INFINITY;
  } else {
    const lastMs = Date.parse(latest.assessment_date + "T12:00:00Z");
    if (Number.isNaN(lastMs)) return [];
    daysSince = Math.floor((todayMs - lastMs) / 86_400_000);
  }

  if (daysSince < PROMPT_AFTER_DAYS) return [];

  const neverDone = !latest;
  return [
    {
      id: `fortnightly_due_${inputs.todayISO}`,
      // Mid-priority: more important than discipline cadence prompts
      // (60s) but less than zone alerts (0–30) or trend nudges (40–50).
      // Lands in the "important but unhurried" lane.
      priority: 55,
      category: "checkin",
      tone: "info",
      title: {
        en: neverDone
          ? "Fortnightly check"
          : "Fortnightly check is due",
        zh: neverDone ? "两周一次的功能评估" : "两周一次的功能评估到期",
      },
      body: {
        en: neverDone
          ? "About 10 minutes — grip strength, gait, ECOG, and a few function tests. The numbers it captures power most of the trend detection on this app."
          : `It's been ${daysSince} days since the last one. About 10 minutes — grip, gait, ECOG, and a few function tests.`,
        zh: neverDone
          ? "约 10 分钟 —— 握力、步速、ECOG、几项功能测试。这些数据是趋势监测的主要来源。"
          : `距上次已经 ${daysSince} 天。约 10 分钟 —— 握力、步速、ECOG、几项功能测试。`,
      },
      cta: {
        href: "/fortnightly/new",
        label: { en: "Open", zh: "开始" },
      },
      icon: "clipboard",
      source: "fortnightly_cadence",
    },
  ];
}
