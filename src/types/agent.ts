import type { FeedItem } from "./feed";
import type { LocalizedText } from "./localized";
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
// Legacy-module tags (memory / social / legacy_voice / legacy_session /
// cooking / practice) route to biographer / orchestrator when those
// agents land in slices 13 + 15. Until then they route to [] — no
// clinical fan-out, which is the correct end-state anyway.
export type LogTag =
  | "diet"
  | "toxicity"
  | "physical"
  | "symptom"
  | "tumour"
  | "mental"
  | "treatment"
  | "labs"
  | "memory"
  | "social"
  | "legacy_voice"
  | "legacy_session"
  | "cooking"
  | "practice";

export const LOG_TAGS: readonly LogTag[] = [
  "diet",
  "toxicity",
  "physical",
  "symptom",
  "tumour",
  "mental",
  "treatment",
  "labs",
  "memory",
  "social",
  "legacy_voice",
  "legacy_session",
  "cooking",
  "practice",
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
  title: LocalizedText;
  detail: LocalizedText;
  rule_id?: string; // optional zone-rule id if mapped to the engine
}

export interface FollowUpQuestion {
  id: string; // stable id so the feed can dedup
  prompt: LocalizedText;
  kind: "numeric" | "yesno" | "text" | "scale_0_10";
}

// Multi-day follow-up emitted by an agent. Persisted in `agent_followups`
// and re-surfaced into the unified feed when its `due_at` matures.
//
// Shape rules:
//   - `question_key` must be stable across runs of the same condition so
//     dedup works (e.g. `nutrition.loose_stools_3d`). Same key with a
//     later `asked_at` supersedes the earlier row.
//   - `ask_in_days` is relative to the producing run's `ran_at`. The
//     run-agents persistence layer turns it into an absolute `due_at`.
//   - `priority` lets the producer hint the feed renderer; lower number
//     = higher rank. If absent, the feed defaults to 50 (above gentle
//     trend nudges, below safety alerts).
export interface AgentFollowUp {
  question_key: string;
  ask_in_days: number;
  prompt: LocalizedText;
  // Optional patient-facing one-line reason ("loose stools 3 days running").
  reason?: LocalizedText;
  priority?: number;
}

// Everything a specialist returns on one batch run (a day's referrals or
// an on-demand invocation). The same shape is used for both the daily
// scheduled run and an explicit "run now" trigger from the patient or
// Thomas, so the consumer never has to branch on trigger type.
export interface AgentOutput {
  // Patient-facing morning brief for this batch — markdown narrative the
  // feed renders as the agent's daily report card.
  daily_report: LocalizedText;
  safety_flags: SafetyFlag[];
  filings: DexiePatch[];
  questions: FollowUpQuestion[];
  nudges: FeedItem[];
  // Optional. Multi-day follow-up loop: each entry becomes one row in
  // `agent_followups` and re-surfaces in the feed when due. Absent on
  // older runs / agents that don't emit them.
  follow_ups?: AgentFollowUp[];
  state_diff: string; // full rewrite of the agent's state.md content
}

// Persisted follow-up row. One per AgentFollowUp emission; the resurface
// engine reads this table on every feed compose and includes any row
// whose due_at <= today and resolved_at is null.
//
// Resolution semantics: a follow-up resolves when (a) the same agent
// emits a fresh row with the same `question_key` (the new row supersedes
// the old; the old gets resolved_at set), (b) the patient marks it done
// from the feed, or (c) the rule that triggered it stops being true (the
// agent omits it on its next run).
export interface AgentFollowUpRow {
  id?: number;
  agent_id: AgentId;
  question_key: string;
  asked_at: string;        // when the producing run completed
  due_at: string;          // when this should resurface (asked_at + ask_in_days)
  prompt_en: string;
  prompt_zh: string;
  reason_en?: string;
  reason_zh?: string;
  priority: number;        // lower = higher rank in the feed
  source_run_id?: number;  // agent_runs.id that emitted this
  resolved_at?: string;
  resolved_by?: "agent_supersede" | "patient_acknowledged" | "stale";
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
