import type { FeedItem, LocalizedString } from "./feed";
import type { Locale } from "./clinical";

// IDs of specialist agents. No triage agent — routing is deterministic
// (see src/lib/log/tag.ts and src/agents/routing.ts).
export type AgentId =
  | "treatment"
  | "nutrition"
  | "rehabilitation"
  | "clinical"
  | "toxicity"
  | "psychology";

export const AGENT_IDS: readonly AgentId[] = [
  "treatment",
  "nutrition",
  "rehabilitation",
  "clinical",
  "toxicity",
  "psychology",
] as const;

// Tags the deterministic tagger emits from free text. Dad can toggle
// these in /log before submit; each tag resolves to one or more agents.
export type LogTag =
  | "diet"
  | "toxicity"
  | "physical"
  | "symptom"
  | "tumour"
  | "mental"
  | "treatment"
  | "labs";

export const LOG_TAGS: readonly LogTag[] = [
  "diet",
  "toxicity",
  "physical",
  "symptom",
  "tumour",
  "mental",
  "treatment",
  "labs",
] as const;

export interface LogInput {
  text: string;
  imageUrl?: string;
  tags: LogTag[];
  locale: Locale;
  at: string; // ISO timestamp
}

// A structured patch the agent asks the client to apply to Dexie.
// The server runs agents in a Node route that cannot touch the patient's
// IndexedDB — so the route returns patches and the client applies them.
export interface DexiePatch {
  table:
    | "daily_entries"
    | "weekly_assessments"
    | "fortnightly_assessments"
    | "medications"
    | "medication_events"
    | "life_events"
    | "labs"
    | "pending_results";
  // `upsert_by_date` uses { date: "YYYY-MM-DD" } as the natural key
  // (daily/weekly/fortnightly/labs); `add` creates a new row.
  strategy: "upsert_by_date" | "add";
  data: Record<string, unknown>;
}

export interface SafetyFlag {
  level: "red" | "orange" | "yellow";
  title: LocalizedString;
  detail: LocalizedString;
  rule_id?: string; // optional zone-rule id if mapped to the engine
}

export interface FollowUpQuestion {
  id: string; // stable id so the feed can dedup
  prompt: LocalizedString;
  kind: "numeric" | "yesno" | "text" | "scale_0_10";
}

// Everything a specialist returns on one referral.
export interface AgentOutput {
  safety_flags: SafetyFlag[];
  filings: DexiePatch[];
  questions: FollowUpQuestion[];
  nudges: FeedItem[];
  state_diff: string; // full rewrite of the agent's state.md content
}

// Persisted per-agent state summary (one row per agent).
export interface AgentStateRow {
  id?: number;
  agent_id: AgentId;
  content: string; // markdown, ≤ ~800 tokens
  updated_at: string;
}

// Raw log event — the single source of truth for what dad told the system.
// Indexed by `at` for feed time-decay ranking.
export interface LogEventRow {
  id?: number;
  at: string;
  input: LogInput;
  // Per-agent output snapshots. Keyed by agent_id; absent for agents not
  // routed to on this log.
  outputs: Partial<Record<AgentId, AgentOutput>>;
  // Server-applied summary. Filled in after /api/log merges results.
  summary?: string;
}
