import { NextResponse } from "next/server";
import { z } from "zod";
import type { AgentId, AgentOutput, LogInput, LogTag } from "~/types/agent";
import { AGENT_IDS, LOG_TAGS } from "~/types/agent";
import { agentsForTags } from "~/agents/routing";
import { runAgent } from "~/agents/run";
import { tagInput } from "~/lib/log/tag";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().default(""),
  imageUrl: z.string().optional(),
  tags: z.array(z.enum(LOG_TAGS as unknown as [LogTag, ...LogTag[]])).default([]),
  locale: z.enum(["en", "zh"]).default("en"),
  at: z.string().optional(),
});

// In-memory agent state, seeded from the request. The client is the
// canonical owner of Dexie; the server is stateless except during one
// request. The client passes the current state.md blobs in and applies the
// returned state_diff back to Dexie after the response lands.
const StateBagSchema = z
  .record(z.enum(AGENT_IDS as unknown as [AgentId, ...AgentId[]]), z.string())
  .default({});

const WrappedSchema = z.object({
  input: RequestSchema,
  state: StateBagSchema.optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = WrappedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { input: raw, state = {} } = parsed.data;
  const input: LogInput = {
    text: raw.text,
    imageUrl: raw.imageUrl,
    // Server-side backstop tagger — union with whatever the client sent.
    tags: Array.from(new Set([...(raw.tags ?? []), ...tagInput(raw.text)])),
    locale: raw.locale,
    at: raw.at ?? new Date().toISOString(),
  };

  const agentIds = agentsForTags(input.tags);
  if (agentIds.length === 0) {
    return NextResponse.json({
      input,
      outputs: {} as Record<AgentId, AgentOutput>,
      agent_ids: [],
      note: "No tags resolved to an agent — nothing to do",
    });
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

  const settled = await Promise.all(
    agentIds.map(async (id) => {
      try {
        const output = await runAgent({ id, input, stateMd: state[id] ?? "" });
        return { id, ok: true as const, output };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { id, ok: false as const, message };
      }
    }),
  );

  const outputs: Partial<Record<AgentId, AgentOutput>> = {};
  const errors: Array<{ id: AgentId; message: string }> = [];
  for (const result of settled) {
    if (result.ok) {
      outputs[result.id] = result.output;
    } else {
      errors.push({ id: result.id, message: result.message });
    }
  }

  return NextResponse.json({
    input,
    agent_ids: agentIds,
    outputs,
    errors,
  });
}
