import { NextResponse } from "next/server";
import { z } from "zod";
import type {
  AgentFeedbackRow,
  AgentId,
  AgentOutput,
  LogEventRow,
  LogTag,
} from "~/types/agent";
import { AGENT_IDS, LOG_TAGS } from "~/types/agent";
import { runAgent } from "~/agents/run";
import { readJsonBody } from "~/lib/anthropic/route-helpers";
import { requireSession } from "~/lib/auth/require-session";
import { loadHouseholdProfile } from "~/lib/household/profile";

export const runtime = "nodejs";
// Specialist agents chew through referrals + state and emit up to 2k tokens
// of structured output. 60s is the safe ceiling across Vercel paid tiers.
export const maxDuration = 60;

// We accept the day's referrals + current state.md from the caller (the
// patient's browser, or a Vercel Cron driver) so the route stays stateless
// and doesn't need its own Supabase auth wiring. The client owns Dexie
// and posts the slice of log_events it wants this agent to consider.

const logInputSchema = z.object({
  text: z.string(),
  imageUrl: z.string().optional(),
  tags: z.array(z.enum(LOG_TAGS as unknown as [LogTag, ...LogTag[]])),
  locale: z.enum(["en", "zh"]),
  at: z.string(),
});

const logEventSchema = z.object({
  id: z.number().optional(),
  at: z.string(),
  input: logInputSchema,
  consumed_by: z.array(z.number()).optional(),
});

const feedbackSchema = z.object({
  id: z.number().optional(),
  agent_id: z.enum(AGENT_IDS as unknown as [AgentId, ...AgentId[]]),
  run_id: z.number(),
  kind: z.enum(["thumbs_up", "thumbs_down", "correction"]),
  by: z.enum(["patient", "thomas", "clinician"]),
  notes: z.string().optional(),
  at: z.string(),
});

const RequestSchema = z.object({
  referrals: z.array(logEventSchema),
  state_md: z.string().default(""),
  recent_feedback: z.array(feedbackSchema).default([]),
  locale: z.enum(["en", "zh"]),
  date: z.string(), // YYYY-MM-DD
  trigger: z.enum(["daily_batch", "on_demand"]).default("on_demand"),
  // Optional pre-formatted coverage snapshot — see
  // ~/lib/coverage/agent-snapshot. The client computes this from
  // Dexie state before posting; older clients omit it and the agent
  // runs without absence reasoning.
  coverage_snapshot: z.string().optional(),
});

const AGENT_ID_SET = new Set<AgentId>(AGENT_IDS);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id as AgentId;
  if (!AGENT_ID_SET.has(id)) {
    return NextResponse.json(
      {
        error: `Unknown agent id: ${params.id}`,
        valid: AGENT_IDS,
      },
      { status: 404 },
    );
  }

  const auth = await requireSession();
  if (!auth.ok) return auth.error;

  const json = await readJsonBody<unknown>(req);
  if (json.error) return json.error;

  const parsed = RequestSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured on the server. Set it in Vercel env.",
      },
      { status: 503 },
    );
  }

  const profile = await loadHouseholdProfile(auth.session.household_id);

  let output: AgentOutput;
  try {
    output = await runAgent({
      id,
      referrals: parsed.data.referrals as LogEventRow[],
      stateMd: parsed.data.state_md,
      recentFeedback: parsed.data.recent_feedback as AgentFeedbackRow[],
      locale: parsed.data.locale,
      date: parsed.data.date,
      trigger: parsed.data.trigger,
      profile,
      coverageSnapshot: parsed.data.coverage_snapshot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Agent run failed", message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    agent_id: id,
    ran_at: new Date().toISOString(),
    referral_count: parsed.data.referrals.length,
    trigger: parsed.data.trigger,
    output,
  });
}
