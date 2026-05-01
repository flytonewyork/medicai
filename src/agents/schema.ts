import { z } from "zod/v4";

// Shared Zod output schema for every specialist agent. The server uses this
// as the `output_config.format` target so Claude returns validated JSON.

const localizedString = z.object({
  en: z.string(),
  zh: z.string(),
});

const dexiePatchSchema = z.object({
  table: z.enum([
    "daily_entries",
    "weekly_assessments",
    "fortnightly_assessments",
    "medications",
    "medication_events",
    "life_events",
    "labs",
    "pending_results",
  ]),
  strategy: z.enum(["upsert_by_date", "add"]),
  data: z.record(z.string(), z.unknown()),
});

const safetyFlagSchema = z.object({
  level: z.enum(["red", "orange", "yellow"]),
  title: localizedString,
  detail: localizedString,
  rule_id: z.string().optional(),
});

const followUpQuestionSchema = z.object({
  id: z.string(),
  prompt: localizedString,
  kind: z.enum(["numeric", "yesno", "text", "scale_0_10"]),
});

// Multi-day follow-up. Mirrors AgentFollowUp in src/types/agent.ts.
// Persisted into agent_followups; re-surfaces in the feed when due.
const followUpSchema = z.object({
  question_key: z.string(),
  ask_in_days: z.number().int().min(0).max(30),
  prompt: localizedString,
  reason: localizedString.optional(),
  priority: z.number().optional(),
});

const feedItemSchema = z.object({
  id: z.string(),
  priority: z.number(),
  category: z.enum([
    "safety",
    "checkin",
    "treatment",
    "task",
    "weather",
    "body",
    "trend",
    "encouragement",
  ]),
  tone: z.enum(["info", "caution", "warning", "positive"]),
  title: localizedString,
  body: localizedString,
  cta: z
    .object({
      href: z.string(),
      label: localizedString,
    })
    .optional(),
  icon: z.string().optional(),
  source: z.string().optional(),
});

export const AgentOutputSchema = z.object({
  daily_report: localizedString,
  safety_flags: z.array(safetyFlagSchema),
  filings: z.array(dexiePatchSchema),
  questions: z.array(followUpQuestionSchema),
  nudges: z.array(feedItemSchema),
  follow_ups: z.array(followUpSchema).optional(),
  state_diff: z.string(),
});

export type AgentOutputParsed = z.infer<typeof AgentOutputSchema>;
