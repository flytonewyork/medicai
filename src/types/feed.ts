import type { LocalizedText } from "./localized";

export { localize } from "./localized";
export type { LocalizedText } from "./localized";

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
  // Coverage-engine prompts: a curated, dismissible nudge that the
  // patient hasn't logged a particular field today / this week. Calm
  // by design — capped per day by engagement state, suppressed
  // entirely during a rough patch. See src/lib/coverage.
  | "coverage"
  // Legacy-module categories. `memory` resurfaces anniversary items at
  // low priority; `invitation` carries orchestrator event suggestions
  // (slice 15). Both are always lower-priority than clinical items.
  | "memory"
  | "invitation";

export type FeedTone = "info" | "caution" | "warning" | "positive";

export interface FeedItem {
  id: string;
  priority: number;
  category: FeedCategory;
  tone: FeedTone;
  title: LocalizedText;
  body: LocalizedText;
  cta?: { href: string; label: LocalizedText };
  icon?: string;
  source?: string;
  // Optional structured meta for sources that need to thread state back
  // to the renderer (e.g. agent_run cards rendering thumbs/correction
  // controls, coverage cards rendering a dismiss button). Discriminated
  // by `kind`.
  meta?: AgentRunMeta | CoverageMeta;
}

export type AgentRunMeta = {
  kind: "agent_run";
  agent_id: string;
  run_id: number;
};

export type CoverageMeta = {
  kind: "coverage";
  field_key: string;
  why: LocalizedText;
};
