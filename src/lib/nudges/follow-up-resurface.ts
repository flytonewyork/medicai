import type { AgentFollowUpRow } from "~/types/agent";
import type { FeedItem } from "~/types/feed";
import {
  AGENT_VOICES,
  FOLLOW_UP_PRIORITY,
  MAX_FOLLOW_UPS_PER_DAY,
} from "~/config/agent-cadence";

// Resurfaces matured, unresolved agent follow-ups as ranked feed items.
// One feed item per follow-up row whose `due_at` ≤ today and whose
// `resolved_at` is null. Capped via MAX_FOLLOW_UPS_PER_DAY so the feed
// doesn't get colonised by old questions.
//
// The composer is responsible for fetching the rows from Dexie and
// passing them in — keeps this module pure and trivially testable.

export interface ResurfaceInputs {
  todayISO: string; // YYYY-MM-DD
  // All currently-unresolved follow-ups for the household. The function
  // filters by `due_at <= todayISO` and ranks internally.
  followUps: AgentFollowUpRow[];
  // True if any red zone alert is currently active. We still surface
  // follow-ups when red is on (they're already-promised questions, not
  // new chatter), but we cap to one to keep the feed quiet.
  redZoneActive: boolean;
}

export function resurfaceFollowUps(inputs: ResurfaceInputs): FeedItem[] {
  const cap = inputs.redZoneActive ? 1 : MAX_FOLLOW_UPS_PER_DAY;
  const due = inputs.followUps
    .filter((row) => !row.resolved_at && row.due_at.slice(0, 10) <= inputs.todayISO)
    // Lower priority number = higher rank; tie-break on earliest due first.
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.due_at.localeCompare(b.due_at);
    })
    .slice(0, cap);

  return due.map((row) => followUpToFeedItem(row));
}

function followUpToFeedItem(row: AgentFollowUpRow): FeedItem {
  const voice = AGENT_VOICES[row.agent_id];
  const titlePrefix = voice.display_name;
  return {
    id: `followup_${row.agent_id}_${row.question_key}`,
    priority: row.priority ?? FOLLOW_UP_PRIORITY,
    category: "checkin",
    tone: "info",
    title: {
      en: `${titlePrefix.en} · follow-up`,
      zh: `${titlePrefix.zh} · 回访`,
    },
    body: {
      en: row.reason_en
        ? `${row.prompt_en} (${row.reason_en})`
        : row.prompt_en,
      zh: row.reason_zh
        ? `${row.prompt_zh}（${row.reason_zh}）`
        : row.prompt_zh,
    },
    cta: {
      href: "/log",
      label: { en: "Reply", zh: "回复" },
    },
    icon: voice.icon,
    source: `agent_followup:${row.agent_id}:${row.question_key}`,
  };
}
