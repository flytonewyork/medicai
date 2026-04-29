import type { FeedItem } from "~/types/feed";
import type { Zone } from "~/types/clinical";
import type { BiographicalOutline } from "~/types/legacy";
import type { TreatmentCycle } from "~/types/treatment";
import type { LocalizedText } from "~/types/localized";

// Orchestrator — deterministic event-suggestion layer.
//
// Emits "invitation" FeedItems for gentle social proposals: a beach
// walk on a good day, a dim-sum dinner during cycle recovery, a Lunar
// New Year family dinner where an under-covered biographical chapter
// could naturally come up.
//
// Design rules:
//   1. Never suggest activities during Orange/Red zones.
//   2. Favour low-energy suggestions in early-cycle (nadir) days.
//   3. Weight seasonal/cultural dates (Lunar New Year, Mid-Autumn).
//   4. Use biographical outline gaps to bias themes, not to coerce.
//   5. At most 1–2 suggestions per day; never more than 3 queued.
//
// Inputs are deliberately typed as plain arrays so the function is
// deterministic and testable without touching Dexie.

export interface OrchestratorInputs {
  todayISO: string;
  zone: Zone | null;
  cycles: TreatmentCycle[];
  outline: BiographicalOutline[];
  /** Optional recent activity log so we don't suggest the same thing daily. */
  recent_suggestion_ids?: string[];
}

export interface EventSuggestion {
  id: string;
  theme: "lightness" | "seasonal" | "chapter_gap" | "recovery";
  title: LocalizedText;
  body: LocalizedText;
  chapter_hint?: string;
}

const MIN_DAYS_BETWEEN_SUGGESTIONS = 3;

/** Compute today's ranked event suggestions. */
export function proposeEvents(
  inputs: OrchestratorInputs,
): EventSuggestion[] {
  // No suggestions during hard zones.
  if (inputs.zone === "orange" || inputs.zone === "red") return [];

  const suggestions: EventSuggestion[] = [];
  const recent = new Set(inputs.recent_suggestion_ids ?? []);

  const cyclePhase = currentCyclePhase(inputs.cycles, inputs.todayISO);
  if (cyclePhase === "recovery") {
    suggestions.push({
      id: `recovery_outing:${inputs.todayISO}`,
      theme: "recovery",
      title: {
        en: "A gentle outing would land well",
        zh: "出门走走正合时候",
      },
      body: {
        en: "You're in a recovery window. A short walk along the river, or coffee with Dad somewhere quiet, tends to go well on days like this.",
        zh: "现在是恢复期。像沿河散散步,或者找一个安静的地方喝杯咖啡,这种日子往往最适合。",
      },
    });
  }

  if (cyclePhase === "nadir") {
    suggestions.push({
      id: `nadir_home:${inputs.todayISO}`,
      theme: "recovery",
      title: {
        en: "A quiet evening in",
        zh: "家中静静的一个晚上",
      },
      body: {
        en: "Low-energy day likely. Order from somewhere Dad loves and watch a film together.",
        zh: "今日可能精力不足。点一份爸爸爱吃的外卖,一家人看个电影。",
      },
    });
  }

  const seasonal = seasonalSuggestion(inputs.todayISO);
  if (seasonal) suggestions.push(seasonal);

  const chapterGap = chapterGapSuggestion(inputs.outline);
  if (chapterGap) suggestions.push(chapterGap);

  // Strip anything recently suggested.
  return suggestions.filter((s) => !recent.has(s.id)).slice(0, 2);
}

export function suggestionToFeedItem(s: EventSuggestion): FeedItem {
  return {
    id: `invitation:${s.id}`,
    priority: 90,
    category: "invitation",
    tone: "positive",
    title: s.title,
    body: s.body,
    cta: {
      href: "/schedule/new",
      label: {
        en: "Add to calendar",
        zh: "加入日程",
      },
    },
    icon: "walk",
    source: "orchestrator",
  };
}

// ── Cycle phase ────────────────────────────────────────────────────

type CyclePhase = "recovery" | "nadir" | "pre_cycle" | "unknown";

function currentCyclePhase(
  cycles: TreatmentCycle[],
  todayISO: string,
): CyclePhase {
  const today = new Date(todayISO + "T12:00:00").getTime();
  if (!Number.isFinite(today)) return "unknown";
  const active = cycles
    .filter((c) => c.status === "active")
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  if (!active) return "unknown";
  const start = new Date(active.start_date + "T12:00:00").getTime();
  const dayInCycle = Math.floor((today - start) / (24 * 60 * 60 * 1000));
  if (dayInCycle < 0) return "pre_cycle";
  if (dayInCycle >= 8 && dayInCycle <= 12) return "nadir";
  if (dayInCycle >= 18) return "recovery";
  return "unknown";
}

// ── Seasonal / cultural ────────────────────────────────────────────

function seasonalSuggestion(todayISO: string): EventSuggestion | null {
  // Rough fixed-date proxies. Lunar calendar is year-dependent; a real
  // implementation would use a lookup table. For now: a small set of
  // Western-calendar cultural anchors for the patient's context.
  const md = todayISO.slice(5, 10); // MM-DD
  const SEASON: Record<string, EventSuggestion> = {
    "02-17": {
      id: `seasonal:lunar-new-year:${todayISO}`,
      theme: "seasonal",
      title: {
        en: "Lunar New Year — a family dinner",
        zh: "春节 — 一家人围桌",
      },
      body: {
        en: "A good moment for the full table, the old dishes, and stories from home.",
        zh: "正是围桌、做几样老菜、讲家乡故事的好时候。",
      },
      chapter_hint: "origins",
    },
    "09-15": {
      id: `seasonal:mid-autumn:${todayISO}`,
      theme: "seasonal",
      title: {
        en: "Mid-Autumn — mooncakes and a quiet evening",
        zh: "中秋 — 月饼、清静的一晚",
      },
      body: {
        en: "A family evening with mooncakes and old music is a gentle anchor.",
        zh: "月饼、老歌、一家人坐坐,是安静的时刻。",
      },
      chapter_hint: "practice",
    },
  };
  return SEASON[md] ?? null;
}

// ── Chapter gap ────────────────────────────────────────────────────

function chapterGapSuggestion(
  outline: BiographicalOutline[],
): EventSuggestion | null {
  const sparse = outline
    .filter((c) => c.target_depth !== "optional" && c.coverage < 0.3)
    .sort((a, b) => a.arc_position - b.arc_position)[0];
  if (!sparse) return null;
  return {
    id: `chapter_gap:${sparse.chapter}`,
    theme: "chapter_gap",
    title: {
      en: `An evening to talk about ${sparse.chapter}`,
      zh: `聊一聊"${sparse.chapter}"`,
    },
    body: {
      en: `"${sparse.chapter}" hasn't come up much lately. A relaxed dinner would be the right setting for Dad to talk through it.`,
      zh: `关于"${sparse.chapter}",最近聊得不多。一顿轻松的晚餐,是爸爸慢慢讲的合适场景。`,
    },
    chapter_hint: sparse.chapter,
  };
}
