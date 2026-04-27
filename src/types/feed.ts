import type { Locale } from "./clinical";

export type FeedCategory =
  | "safety"
  | "checkin"
  | "treatment"
  | "task"
  | "weather"
  | "body"
  | "trend"
  | "encouragement"
  // Nutrition-policy / JPCC-derived items. Sits between `body` (raw
  // physical signal) and `trend` (statistical drift) — these carry
  // dietitian-grade recommendations with explicit citations.
  | "nutrition"
  // Legacy-module categories. `memory` resurfaces anniversary items at
  // low priority; `invitation` carries orchestrator event suggestions
  // (slice 15). Both are always lower-priority than clinical items.
  | "memory"
  | "invitation";

export type FeedTone = "info" | "caution" | "warning" | "positive";

export interface LocalizedString {
  en: string;
  zh: string;
}

export interface FeedItem {
  id: string;
  priority: number;
  category: FeedCategory;
  tone: FeedTone;
  title: LocalizedString;
  body: LocalizedString;
  cta?: { href: string; label: LocalizedString };
  icon?: string;
  source?: string;
  // Optional structured meta for sources that need to thread state back
  // to the renderer (e.g. agent_run cards rendering thumbs/correction
  // controls). Discriminated by `kind`.
  meta?: AgentRunMeta;
}

export type AgentRunMeta = {
  kind: "agent_run";
  agent_id: string;
  run_id: number;
};

export function localize(s: LocalizedString, locale: Locale): string {
  return s[locale] ?? s.en;
}
