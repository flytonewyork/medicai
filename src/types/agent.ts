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
  // Slice C: attribution pair. `entered_by` is the device-local
  // ui-store label; `entered_by_user_id` is the Supabase auth.uid of
  // the signed-in user, if any. <Attribution /> prefers the profile
  // lookup and falls back to the label.
  entered_by?: string;
  entered_by_user_id?: string;
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

// Everything a specialist returns on one batch run (a day's referrals or
// an on-demand invocation). The same shape is used for both the daily
// scheduled run and an explicit "run now" trigger from the patient or
// Thomas, so the consumer never has to branch on trigger type.
export interface AgentOutput {
  // Patient-facing morning brief for this batch — markdown narrative the
  // feed renders as the agent's daily report card.
  daily_report: LocalizedString;
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
// Indexed by `at` for batch slicing ("today's referrals for nutrition").
export interface LogEventRow {
  id?: number;
  at: string;
  input: LogInput;
  // Set after a daily batch or on-demand run consumes this event. The
  // referenced AgentRunRow.id values let us audit which run produced
  // which fillings/nudges for this log. Empty until first batch consumes.
  consumed_by?: number[];
}

// One row per agent invocation (daily batch or on-demand). Indexed by
// agent_id + ran_at for "show me the latest report" queries.
export interface AgentRunRow {
  id?: number;
  agent_id: AgentId;
  ran_at: string;
  trigger: "daily_batch" | "on_demand";
  // The log_events.id values fed into this run.
  referral_ids: number[];
  output: AgentOutput;
}

// Human-in-the-loop feedback against a specific run. Closes the dial-in
// loop: each subsequent run gets a digest of recent feedback as a cached
// system block, so the agent can adjust tone, calibration, or scope based
// on how Thomas / the patient has reacted to past reports.
export type FeedbackKind = "thumbs_up" | "thumbs_down" | "correction";
export type FeedbackBy = "patient" | "thomas" | "clinician";

export interface AgentFeedbackRow {
  id?: number;
  agent_id: AgentId;
  run_id: number; // foreign key into agent_runs
  kind: FeedbackKind;
  by: FeedbackBy;
  // Optional free-text. For `correction` kind this is what should have
  // been said / filed instead — the agent is told to take it as ground
  // truth on the next run.
  notes?: string;
  at: string;
}
