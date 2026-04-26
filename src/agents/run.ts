import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentFeedbackRow,
  AgentId,
  AgentOutput,
  LogEventRow,
  LogInput,
} from "~/types/agent";
import type { Locale } from "~/types/clinical";
import { AgentOutputSchema } from "./schema";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";

// Server-side runtime for one specialist invocation. Takes the batch of
// log events that routed to this agent (a day's worth, typically) plus the
// agent's current state.md, and returns one AgentOutput. Same code path
// for the daily scheduled run and an explicit "run now" trigger.
//
// The caller is responsible for reading state.md from Dexie before, and
// writing the returned `state_diff` + persisting the AgentRunRow after.

const MODEL = process.env.ANTHROPIC_LOG_MODEL || DEFAULT_AI_MODEL;

function roleFor(id: AgentId): string {
  // Role files are committed to the repo. We resolve them relative to the
  // project root at request time so they ship with the server build.
  const path = join(process.cwd(), "src", "agents", id, "role.md");
  return readFileSync(path, "utf8");
}

function formatReferrals(referrals: readonly LogEventRow[]): string {
  if (referrals.length === 0) {
    return "(no new logs since the last run — produce a maintenance report from your state.md)";
  }
  return referrals
    .map((row, i) => {
      const lines = [
        `[${i + 1}] ${row.at}  ·  tags: ${row.input.tags.join(", ") || "(none)"}`,
      ];
      if (row.input.text.trim()) {
        lines.push(`text: ${row.input.text.trim()}`);
      }
      if (row.input.imageUrl) {
        lines.push(`image: ${row.input.imageUrl}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatFeedback(rows: readonly AgentFeedbackRow[]): string {
  if (rows.length === 0) {
    return "(no recent feedback — proceed with your usual approach)";
  }
  return rows
    .map((row, i) => {
      const head = `[${i + 1}] ${row.at}  ·  ${row.by} → ${row.kind} on run #${row.run_id}`;
      return row.notes ? `${head}\nnote: ${row.notes}` : head;
    })
    .join("\n\n");
}

export interface RunAgentArgs {
  id: AgentId;
  referrals: readonly LogEventRow[];
  stateMd: string;
  // Most recent feedback rows for this agent (typically the last ~10).
  // Closes the dial-in loop: the agent sees how recent reports landed
  // and adjusts. Empty array on first run.
  recentFeedback: readonly AgentFeedbackRow[];
  locale: Locale;
  date: string; // "YYYY-MM-DD" — the day this run is producing a report for
  trigger: "daily_batch" | "on_demand";
}

export async function runAgent(args: RunAgentArgs): Promise<AgentOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }
  const [{ default: Anthropic }, { jsonOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("~/lib/anthropic/json-output"),
  ]);
  const client = new Anthropic({ apiKey });

  const userText = [
    `Date: ${args.date}`,
    `Locale: ${args.locale}`,
    `Trigger: ${args.trigger}`,
    `Referrals routed to you (${args.referrals.length}):`,
    "",
    formatReferrals(args.referrals),
  ].join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: roleFor(args.id),
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text:
          args.stateMd.trim().length > 0
            ? `Your current state summary (state.md):\n\n${args.stateMd}`
            : "Your current state summary is empty — this is the first batch you're seeing.",
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `Recent feedback on your past runs (most recent first):\n\n${formatFeedback(args.recentFeedback)}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: jsonOutputFormat(AgentOutputSchema) },
    messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
  });

  if (!response.parsed_output) {
    throw new Error(`Agent ${args.id} returned no parsed output`);
  }
  return response.parsed_output as AgentOutput;
}

// Pure helper: select the log_events whose tags route to this agent. Used
// by both the daily-batch driver and the on-demand route. Importable from
// non-server code so the client can preview "what would the agent see if
// we ran it now?"
export function selectReferralsForAgent(
  agentId: AgentId,
  events: readonly LogEventRow[],
  routing: (tags: readonly LogInput["tags"][number][]) => readonly AgentId[],
): LogEventRow[] {
  return events.filter((row) => routing(row.input.tags).includes(agentId));
}
