import { db, now } from "~/lib/db/dexie";
import type {
  AgentFeedbackRow,
  AgentId,
  AgentOutput,
  AgentRunRow,
  DexiePatch,
  LogEventRow,
} from "~/types/agent";
import type { Locale } from "~/types/clinical";
import { agentsForTags } from "~/agents/routing";

// Client-side orchestration for running one specialist agent.
// 1. Read state.md + recent feedback for this agent from Dexie
// 2. Slice the day's referrals routed to this agent
// 3. POST /api/agent/{id}/run
// 4. Persist agent_runs row, rewrite state.md, apply DexiePatch filings,
//    promote red safety flags into zone_alerts, mark log_events consumed
//
// Returns the agent_runs row id on success; null on configuration failure
// (e.g. no key); throws on transport/validation failure.

export interface RunAgentClientArgs {
  agentId: AgentId;
  date: string; // YYYY-MM-DD
  locale: Locale;
  trigger: "daily_batch" | "on_demand";
  // Optional explicit referral ids; defaults to all log_events with at >=
  // start-of-day for this agent's tags.
  referralIds?: number[];
}

export async function runAgentClient(
  args: RunAgentClientArgs,
): Promise<number | null> {
  const stateRow = await db.agent_states
    .where("agent_id")
    .equals(args.agentId)
    .first();
  const stateMd = stateRow?.content ?? "";

  // Most recent N feedback rows for this agent. Cap so the prompt stays bounded.
  const feedback = await db.agent_feedback
    .where("[agent_id+at]")
    .between([args.agentId, ""], [args.agentId, "￿"])
    .reverse()
    .limit(10)
    .toArray();

  let referrals: LogEventRow[];
  if (args.referralIds && args.referralIds.length > 0) {
    referrals = (
      await Promise.all(args.referralIds.map((id) => db.log_events.get(id)))
    ).filter((r): r is LogEventRow => Boolean(r));
  } else {
    const dayStart = new Date(args.date + "T00:00:00.000Z").toISOString();
    const dayEnd = new Date(args.date + "T23:59:59.999Z").toISOString();
    const allInDay = await db.log_events
      .where("at")
      .between(dayStart, dayEnd)
      .toArray();
    referrals = allInDay.filter((r) =>
      agentsForTags(r.input.tags).includes(args.agentId),
    );
  }

  const res = await fetch(`/api/agent/${args.agentId}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      referrals,
      state_md: stateMd,
      recent_feedback: feedback,
      locale: args.locale,
      date: args.date,
      trigger: args.trigger,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`agent ${args.agentId} run failed: ${res.status} ${text}`);
  }

  const body = (await res.json()) as {
    agent_id: AgentId;
    ran_at: string;
    output: AgentOutput;
  };

  const referralIds = referrals
    .map((r) => r.id)
    .filter((id): id is number => typeof id === "number");

  const runRow: AgentRunRow = {
    agent_id: body.agent_id,
    ran_at: body.ran_at,
    trigger: args.trigger,
    referral_ids: referralIds,
    output: body.output,
  };
  const runId = await db.agent_runs.add(runRow);

  await rewriteAgentState(args.agentId, body.output.state_diff);
  await applyFilings(body.output.filings);
  await promoteSafetyFlags(args.agentId, body.output.safety_flags, body.ran_at);
  await markConsumed(referralIds, runId);

  return runId;
}

// Map agent_id → RuleCategory for zone_alerts emission. Several agents
// share a category (clinical/treatment both → disease).
const AGENT_TO_RULE_CATEGORY: Record<AgentId, "function" | "toxicity" | "disease" | "psychological" | "nutrition"> = {
  treatment: "disease",
  nutrition: "nutrition",
  rehabilitation: "function",
  clinical: "disease",
  toxicity: "toxicity",
  psychology: "psychological",
};

async function rewriteAgentState(
  agentId: AgentId,
  newContent: string,
): Promise<void> {
  if (!newContent.trim()) return;
  const existing = await db.agent_states
    .where("agent_id")
    .equals(agentId)
    .first();
  const ts = now();
  if (existing?.id) {
    await db.agent_states.update(existing.id, {
      content: newContent,
      updated_at: ts,
    });
  } else {
    await db.agent_states.add({
      agent_id: agentId,
      content: newContent,
      updated_at: ts,
    });
  }
}

async function applyFilings(filings: DexiePatch[]): Promise<void> {
  for (const patch of filings) {
    try {
      await applyOne(patch);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[log] filing failed", patch, err);
    }
  }
}

async function applyOne(patch: DexiePatch): Promise<void> {
  const ts = now();
  const data = { ...patch.data, updated_at: ts } as Record<string, unknown>;

  // Dexie's static union types require per-table dispatch; runtime shape is
  // dynamic by design (the agent decides what fields to file), so we cast
  // through `any` at the boundary. Safety: each row goes through Zod on
  // the server before we apply, and Dexie itself silently ignores unknown
  // columns in the index spec (extras live in the JSON blob).
  const table = tableHandle(patch.table) as unknown as {
    where(field: string): {
      equals(v: unknown): { first(): Promise<{ id?: number } | undefined> };
    };
    update(id: number, changes: Record<string, unknown>): Promise<number>;
    add(row: Record<string, unknown>): Promise<number>;
  } | undefined;
  if (!table) return;

  if (patch.strategy === "upsert_by_date") {
    const dateField = dateFieldForTable(patch.table);
    const dateValue = data[dateField];
    if (typeof dateValue !== "string") {
      throw new Error(
        `upsert_by_date needs ${dateField}: string in data`,
      );
    }
    const existing = await table.where(dateField).equals(dateValue).first();
    if (existing?.id) {
      await table.update(existing.id, data);
    } else {
      await table.add({ ...data, created_at: ts });
    }
    return;
  }

  // strategy === "add"
  await table.add({ ...data, created_at: ts });
}

function dateFieldForTable(table: DexiePatch["table"]): string {
  switch (table) {
    case "weekly_assessments":
      return "week_start";
    case "fortnightly_assessments":
      return "assessment_date";
    case "labs":
      return "date";
    case "daily_entries":
      return "date";
    default:
      return "date";
  }
}

function tableHandle(name: DexiePatch["table"]) {
  switch (name) {
    case "daily_entries":
      return db.daily_entries;
    case "weekly_assessments":
      return db.weekly_assessments;
    case "fortnightly_assessments":
      return db.fortnightly_assessments;
    case "medications":
      return db.medications;
    case "medication_events":
      return db.medication_events;
    case "life_events":
      return db.life_events;
    case "labs":
      return db.labs;
    case "pending_results":
      return db.pending_results;
  }
}

async function promoteSafetyFlags(
  agentId: AgentId,
  flags: AgentOutput["safety_flags"],
  ts: string,
): Promise<void> {
  for (const flag of flags) {
    if (flag.level !== "red") continue;
    await db.zone_alerts.add({
      rule_id: flag.rule_id ?? `agent:${agentId}`,
      rule_name: flag.title.en,
      zone: "red",
      category: AGENT_TO_RULE_CATEGORY[agentId],
      triggered_at: ts,
      resolved: false,
      acknowledged: false,
      recommendation: flag.detail.en,
      recommendation_zh: flag.detail.zh,
      suggested_levers: [],
      created_at: ts,
      updated_at: ts,
    });
  }
}

async function markConsumed(
  referralIds: number[],
  runId: number,
): Promise<void> {
  for (const id of referralIds) {
    const row = await db.log_events.get(id);
    if (!row) continue;
    const consumed = [...(row.consumed_by ?? []), runId];
    await db.log_events.update(id, { consumed_by: consumed });
  }
}

// Convenience: run every agent that has at least one referral today.
export async function runAllAgentsForToday(args: {
  date: string;
  locale: Locale;
  trigger: "daily_batch" | "on_demand";
}): Promise<{ id: AgentId; runId: number | null; error?: string }[]> {
  const dayStart = new Date(args.date + "T00:00:00.000Z").toISOString();
  const dayEnd = new Date(args.date + "T23:59:59.999Z").toISOString();
  const events = await db.log_events
    .where("at")
    .between(dayStart, dayEnd)
    .toArray();

  const agentIds = new Set<AgentId>();
  for (const e of events) {
    for (const id of agentsForTags(e.input.tags)) agentIds.add(id);
  }

  return Promise.all(
    Array.from(agentIds).map(async (id) => {
      try {
        const runId = await runAgentClient({
          agentId: id,
          date: args.date,
          locale: args.locale,
          trigger: args.trigger,
        });
        return { id, runId };
      } catch (err) {
        return {
          id,
          runId: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}
