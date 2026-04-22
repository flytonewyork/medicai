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
import type { AgentRunRow } from "~/types/agent";
import { computeTrendNudges } from "./trend-nudges";
import { computeWeatherNudges } from "./weather-nudges";
import { agentRunsToFeedItems } from "./agent-runs";
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

  // ── 6. Agent daily reports ─────────────────────────────────────────
  if (inputs.agentRuns && inputs.agentRuns.length > 0) {
    feed.push(...agentRunsToFeedItems(inputs.agentRuns));
  }

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
