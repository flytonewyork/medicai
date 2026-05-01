import type { DailyEntry } from "~/types/clinical";
import type { FeedItem } from "~/types/feed";
import { AGENT_VOICES } from "~/config/agent-cadence";
import { buildGiSeries, summariseGiSeries } from "~/lib/calculations/gi-trends";

// Reflexive feed nudges for the GI trend tiles. The /nutrition page's
// Digestion-trends tiles flip to a warn tone when their thresholds
// cross (PERT < 70 %, Bristol mode 6/7 or 1/2, oil ≥ 2 days, BMs avg
// ≥ 4, loose streak ≥ 2). This module mirrors those threshold checks
// and emits a matching FeedItem so the unified channel surfaces the
// drift even when the patient hasn't opened /nutrition.
//
// These are local, deterministic, and cheap — they fire on every
// composeTodayFeed call. Stable IDs keyed to the ISO week so the same
// concern doesn't multiply through the feed across days; the
// composer's dedup pass handles the cross-render case.
//
// Voicing follows AGENT_VOICES — the dietician owns PERT + oil + Bristol
// mode; the nurse owns volume signals (BMs avg, loose streak,
// constipation). Same split as the role.md update in #153.

export interface GiTileNudgeInputs {
  todayISO: string;       // YYYY-MM-DD
  recentDailies: DailyEntry[];
}

const SHORT_WINDOW = 7;
const PERT_COVERAGE_FLOOR = 0.7;
const OIL_DAYS_THRESHOLD = 2;
const COUNT_AVG_THRESHOLD = 4;
const LOOSE_STREAK_THRESHOLD = 2;

const PRIORITY = 35; // above agent_run reports (55), below safety (≤ 30)

export function computeGiTileNudges(inputs: GiTileNudgeInputs): FeedItem[] {
  const series = buildGiSeries(
    inputs.recentDailies,
    inputs.todayISO,
    SHORT_WINDOW,
  );
  const summary = summariseGiSeries(series);
  if (summary.days_with_data === 0) return [];

  const week = isoWeekKey(inputs.todayISO);
  const dietician = AGENT_VOICES.nutrition;
  const nurse = AGENT_VOICES.toxicity;
  const out: FeedItem[] = [];

  if (
    summary.pert_coverage !== null &&
    summary.pert_coverage < PERT_COVERAGE_FLOOR
  ) {
    const pct = Math.round(summary.pert_coverage * 100);
    out.push({
      id: `gi_nudge_pert_low_${week}`,
      priority: PRIORITY,
      category: "nutrition",
      tone: "caution",
      title: dietician.display_name,
      body: {
        en: `PERT coverage was ${pct}% over the last 7 days — Creon needs to land with every fatty meal to keep stool form on track. Worth a quick review.`,
        zh: `近 7 天胰酶 (Creon) 覆盖率 ${pct}% —— 每次高脂餐都需配胰酶才能稳定排便形态，建议简短复核。`,
      },
      cta: { href: "/log", label: { en: "Tell us", zh: "告诉我们" } },
      icon: dietician.icon,
      source: "gi_tile_nudge:pert_low",
    });
  }

  if (summary.bristol_mode !== null && summary.bristol_mode >= 6) {
    out.push({
      id: `gi_nudge_bristol_loose_${week}`,
      priority: PRIORITY,
      category: "nutrition",
      tone: "caution",
      title: dietician.display_name,
      body: {
        en: `Bristol type ${summary.bristol_mode} has been the predominant form this week — that's the PERT-titration signal. Has Creon been taken with every fatty meal?`,
        zh: `本周 Bristol ${summary.bristol_mode} 型为主 —— 这是胰酶剂量需调整的信号。每次高脂餐都吃了 Creon 吗？`,
      },
      cta: { href: "/log", label: { en: "Reply", zh: "回复" } },
      icon: dietician.icon,
      source: "gi_tile_nudge:bristol_loose",
    });
  } else if (summary.bristol_mode !== null && summary.bristol_mode <= 2) {
    out.push({
      id: `gi_nudge_bristol_constip_${week}`,
      priority: PRIORITY,
      category: "body",
      tone: "caution",
      title: nurse.display_name,
      body: {
        en: `Bristol type ${summary.bristol_mode} this week — constipation building. Anti-emetics and opioids both push this way. Worth raising the bowel-care plan.`,
        zh: `本周 Bristol ${summary.bristol_mode} 型 —— 便秘倾向加重。止吐与镇痛药均易造成此情况。建议复核肠道护理方案。`,
      },
      cta: { href: "/log", label: { en: "Reply", zh: "回复" } },
      icon: nurse.icon,
      source: "gi_tile_nudge:bristol_constipation",
    });
  }

  if (summary.oil_days >= OIL_DAYS_THRESHOLD) {
    out.push({
      id: `gi_nudge_oil_${week}`,
      priority: PRIORITY,
      category: "nutrition",
      tone: "caution",
      title: dietician.display_name,
      body: {
        en: `Oily / floating stool flagged on ${summary.oil_days} of the last 7 days. Steatorrhoea pattern — Creon dose likely needs review with the team.`,
        zh: `近 7 天有 ${summary.oil_days} 天为油腻 / 漂浮便。脂肪泻表现 —— Creon 剂量很可能需要与团队复核。`,
      },
      cta: { href: "/log", label: { en: "Reply", zh: "回复" } },
      icon: dietician.icon,
      source: "gi_tile_nudge:oil_steatorrhoea",
    });
  }

  if (
    summary.count_avg !== null &&
    summary.count_avg >= COUNT_AVG_THRESHOLD
  ) {
    out.push({
      id: `gi_nudge_count_high_${week}`,
      priority: PRIORITY,
      category: "body",
      tone: "caution",
      title: nurse.display_name,
      body: {
        en: `BMs averaging ${summary.count_avg.toFixed(1)} per day this week. Hydration + electrolytes are the priority; raise at next clinic if it stays here.`,
        zh: `本周排便平均 ${summary.count_avg.toFixed(1)} 次/日。优先补液 + 电解质；若持续，请下次就诊提出。`,
      },
      cta: { href: "/log", label: { en: "Reply", zh: "回复" } },
      icon: nurse.icon,
      source: "gi_tile_nudge:count_high",
    });
  }

  // The zone-rule layer already catches a 3-day persistent loose streak
  // and routes it to the safety alert lane. This nudge fills the gap
  // between "noticeable" (2 days) and "rule-triggered" (3 days) so the
  // patient sees something before the formal alert lands.
  if (
    summary.loose_streak >= LOOSE_STREAK_THRESHOLD &&
    summary.loose_streak < 3
  ) {
    out.push({
      id: `gi_nudge_loose_streak_${week}`,
      priority: PRIORITY,
      category: "body",
      tone: "caution",
      title: nurse.display_name,
      body: {
        en: `Loose stools two days running. Worth tracking carefully — if it goes a third day, the team should hear.`,
        zh: `稀便已连续两天。请密切观察 —— 若再持续一天，应告知医疗团队。`,
      },
      cta: { href: "/log", label: { en: "Reply", zh: "回复" } },
      icon: nurse.icon,
      source: "gi_tile_nudge:loose_streak",
    });
  }

  return out;
}

// ISO-week-ish key — `2026-W18`. We don't need true ISO 8601 weeks
// (Sunday/Monday-start ambiguity would only shift dedup boundaries by
// a day); a simple year + week-of-year is enough to keep the same
// underlying concern from re-firing daily.
function isoWeekKey(iso: string): string {
  const d = new Date(iso + "T12:00:00.000Z");
  const startOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.floor(
    (d.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000),
  );
  const week = Math.floor(days / 7) + 1;
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
