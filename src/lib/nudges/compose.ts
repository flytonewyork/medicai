import type {
  DailyEntry,
  LabResult,
  Settings,
  ZoneAlert,
} from "~/types/clinical";
import type { PatientTask, TaskInstance } from "~/types/task";
import type { CycleContext, NudgeTemplate } from "~/types/treatment";
import type { CurrentWeather } from "~/lib/weather/open-meteo";
import type { FeedItem } from "~/types/feed";
import type { AgentFollowUpRow, AgentRunRow } from "~/types/agent";
import type { CoverageSnoozeRow } from "~/types/coverage";
import { computeTrendNudges } from "./trend-nudges";
import { computeWeatherNudges } from "./weather-nudges";
import { computeNutritionNudges } from "./nutrition-nudges";
import { computeFoodSafetyNudges } from "./food-safety-nudges";
import { computeChemoBodyFluidNudges } from "./chemo-body-fluid-nudges";
import { agentRunsToFeedItems } from "./agent-runs";
import { resurfaceFollowUps } from "./follow-up-resurface";
import { computeCadencePrompts } from "./cadence-prompts";
import { computeGiTileNudges } from "./gi-tile-nudges";
import { computeCoverageGaps } from "~/lib/coverage/log-coverage";
import { coverageGapsToFeedItems } from "./coverage-cards";
import { getActiveTaskInstances } from "~/lib/tasks/engine";

export interface ComposeInputs {
  todayISO: string;
  settings: Settings | null;
  recentDailies: DailyEntry[]; // chronological ascending
  recentLabs: LabResult[];
  tasks: PatientTask[];
  activeAlerts: ZoneAlert[];
  cycleContext: CycleContext | null;
  weather: CurrentWeather | null;
  agentRuns?: AgentRunRow[];
  // Outstanding multi-day follow-ups across all agents. The composer
  // filters by `due_at <= today` and ranks them. Pass an empty array
  // if the caller has no follow-up state yet.
  followUps?: AgentFollowUpRow[];
  // Active coverage-prompt snoozes. Pass all rows from the
  // coverage_snoozes table; the engine filters expired ones.
  coverageSnoozes?: CoverageSnoozeRow[];
}

export function composeTodayFeed(inputs: ComposeInputs): FeedItem[] {
  const feed: FeedItem[] = [];

  // ── 1. Safety: zone alerts ─────────────────────────────────────────
  for (const alert of inputs.activeAlerts) {
    feed.push(alertToFeedItem(alert));
  }

  // ── 2. Treatment phase nudges ──────────────────────────────────────
  if (inputs.cycleContext) {
    const treatmentItems = cycleNudgesToFeedItems(inputs.cycleContext);
    feed.push(...treatmentItems);
  }

  // ── 3. Task instances ──────────────────────────────────────────────
  const taskInstances = getActiveTaskInstances(
    inputs.tasks,
    new Date(inputs.todayISO + "T12:00:00"),
    inputs.cycleContext,
  );
  for (const inst of taskInstances) {
    const item = taskToFeedItem(inst);
    if (item) feed.push(item);
  }

  // ── 4. Trend nudges ────────────────────────────────────────────────
  feed.push(
    ...computeTrendNudges({
      settings: inputs.settings,
      recentDailies: inputs.recentDailies,
      recentLabs: inputs.recentLabs,
      todayISO: inputs.todayISO,
    }),
  );

  // ── 5. Weather nudges ──────────────────────────────────────────────
  feed.push(
    ...computeWeatherNudges({
      weather: inputs.weather,
      cycleContext: inputs.cycleContext,
    }),
  );

  // ── 5b. Nutrition policy ───────────────────────────────────────────
  feed.push(
    ...computeNutritionNudges({
      settings: inputs.settings,
      recentDailies: inputs.recentDailies,
      todayISO: inputs.todayISO,
    }),
  );

  // ── 5c. Food safety during chemo nadir / early recovery ────────────
  feed.push(
    ...computeFoodSafetyNudges({
      cycleContext: inputs.cycleContext,
      todayISO: inputs.todayISO,
    }),
  );

  // ── 5d. Body-fluid precautions during 48h-after-each-dose window ───
  feed.push(
    ...computeChemoBodyFluidNudges({
      cycleContext: inputs.cycleContext,
      todayISO: inputs.todayISO,
    }),
  );

  // ── 5e. Reflexive GI tile nudges (PERT, Bristol, oil, BMs, streak) ──
  feed.push(
    ...computeGiTileNudges({
      todayISO: inputs.todayISO,
      recentDailies: inputs.recentDailies,
    }),
  );

  // ── 6. Agent daily reports ─────────────────────────────────────────
  if (inputs.agentRuns && inputs.agentRuns.length > 0) {
    feed.push(...agentRunsToFeedItems(inputs.agentRuns));
  }

  // ── 7. Multi-day follow-ups (resurfaced when due) ──────────────────
  if (inputs.followUps && inputs.followUps.length > 0) {
    const redActive = inputs.activeAlerts.some(
      (a) => !a.resolved && a.zone === "red",
    );
    feed.push(
      ...resurfaceFollowUps({
        todayISO: inputs.todayISO,
        followUps: inputs.followUps,
        redZoneActive: redActive,
      }),
    );
  }

  // ── 8. Per-discipline cadence prompts (AI Nurse / Dietician / …) ───
  // The single channel out gets at most a couple of these per day; the
  // cadence module suppresses entirely if any red zone alert is active.
  const todayDaily =
    inputs.recentDailies.find((d) => d.date === inputs.todayISO) ?? null;
  feed.push(
    ...computeCadencePrompts({
      todayISO: inputs.todayISO,
      cycleContext: inputs.cycleContext,
      todayDaily,
      activeAlerts: inputs.activeAlerts,
    }),
  );

  // ── 9. Coverage prompts (calm gap detector) ────────────────────────
  // Reaches out only as far as the patient's recent engagement allows
  // — full quota when active today, smaller when light, one when
  // quiet, none at all during a rough patch. Cards are dismissible
  // (snooze stored in coverage_snoozes); the engine respects active
  // snoozes here.
  const coverage = computeCoverageGaps({
    todayISO: inputs.todayISO,
    recentDailies: inputs.recentDailies,
    settings: inputs.settings,
    cycleContext: inputs.cycleContext,
    activeAlerts: inputs.activeAlerts,
    snoozes: inputs.coverageSnoozes ?? [],
  });
  feed.push(...coverageGapsToFeedItems(coverage.gaps));

  // ── Dedupe + sort + cap ────────────────────────────────────────────
  const seen = new Set<string>();
  const deduped = feed.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
  deduped.sort((a, b) => a.priority - b.priority);
  return deduped;
}

function alertToFeedItem(a: ZoneAlert): FeedItem {
  const safety = a.zone === "red";
  return {
    id: `alert_${a.id ?? a.rule_id}`,
    priority: safety ? 0 : a.zone === "orange" ? 10 : 30,
    category: "safety",
    tone: safety ? "warning" : a.zone === "orange" ? "warning" : "caution",
    title: {
      en: a.rule_name,
      zh: a.rule_name,
    },
    body: {
      en: a.recommendation,
      zh: a.recommendation_zh ?? a.recommendation,
    },
    icon: safety ? "thermo" : "shield",
    source: "zone_alert",
  };
}

function cycleNudgesToFeedItems(ctx: CycleContext): FeedItem[] {
  const out: FeedItem[] = [];
  const topNudges = [...ctx.applicable_nudges]
    .sort((a, b) => severityRank(a) - severityRank(b))
    .slice(0, 3);
  for (const n of topNudges) {
    out.push(nudgeTemplateToFeedItem(n, ctx));
  }
  return out;
}

function severityRank(n: NudgeTemplate): number {
  return n.severity === "warning" ? 0 : n.severity === "caution" ? 1 : 2;
}

function nudgeTemplateToFeedItem(
  n: NudgeTemplate,
  ctx: CycleContext,
): FeedItem {
  const basePriority =
    n.severity === "warning" ? 30 : n.severity === "caution" ? 40 : 60;
  return {
    id: `nudge_${n.id}`,
    priority:
      basePriority +
      (ctx.phase?.key === "nadir" && n.category === "hygiene" ? -5 : 0),
    category: "treatment",
    tone:
      n.severity === "warning"
        ? "warning"
        : n.severity === "caution"
          ? "caution"
          : "info",
    title: n.title,
    body: n.body,
    icon: iconForCategory(n.category),
    source: `cycle_phase:${ctx.phase?.key ?? "unknown"}`,
  };
}

function iconForCategory(c: NudgeTemplate["category"]): string {
  switch (c) {
    case "diet":
      return "food";
    case "hygiene":
      return "shield";
    case "exercise":
      return "walk";
    case "sleep":
      return "moon";
    case "mental":
      return "chat";
    case "safety":
      return "thermo";
    case "meds":
      return "pill";
    case "activity":
      return "sun";
    case "intimacy":
      return "user";
    default:
      return "dot";
  }
}

function taskToFeedItem(inst: TaskInstance): FeedItem | null {
  const t = inst.task;
  const bucket = inst.bucket;
  if (bucket === "snoozed" || bucket === "scheduled") return null;
  const priority =
    bucket === "overdue"
      ? 20
      : bucket === "due_today"
        ? 50
        : bucket === "cycle_relevant"
          ? 45
          : 70;
  const tone =
    bucket === "overdue"
      ? "warning"
      : bucket === "cycle_relevant"
        ? "caution"
        : "info";
  return {
    id: `task_${t.id ?? t.title}`,
    priority,
    category: "task",
    tone,
    title: {
      en: t.title,
      zh: t.title_zh ?? t.title,
    },
    body: {
      en:
        bucket === "overdue"
          ? `Overdue by ${-inst.days_until_due}d`
          : bucket === "due_today"
            ? "Due today"
            : bucket === "cycle_relevant"
              ? (inst.reason ?? "Cycle-relevant")
              : `In ${inst.days_until_due}d`,
      zh:
        bucket === "overdue"
          ? `已过期 ${-inst.days_until_due} 天`
          : bucket === "due_today"
            ? "今日到期"
            : bucket === "cycle_relevant"
              ? (inst.reason ?? "与当前周期相关")
              : `${inst.days_until_due} 天后到期`,
    },
    cta: {
      href: "/tasks",
      label: { en: "Open", zh: "查看" },
    },
    icon: "clock",
    source: "task",
  };
}
