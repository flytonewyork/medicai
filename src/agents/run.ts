import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentId, AgentOutput, LogInput } from "~/types/agent";
import { AgentOutputSchema } from "./schema";

// Shared runtime wrapper for every specialist agent. The server /api/log
// route calls runAgent({ id, input, stateMd }) in parallel for each agent
// returned by routing.ts. Each call is one messages.parse() with prompt
// caching on both role.md and state.md (ephemeral), so subsequent calls on
// the same deploy reuse the cached prefix.
//
// The caller is responsible for reading the current state.md from Dexie
// (via state-store.ts) and writing back the returned state_diff.

const MODEL = process.env.ANTHROPIC_LOG_MODEL || "claude-opus-4-7";

function roleFor(id: AgentId): string {
  // Role files are committed to the repo. We resolve them relative to the
  // project root at build time so they're bundled into the server build.
  const path = join(process.cwd(), "src", "agents", id, "role.md");
  return readFileSync(path, "utf8");
}

export async function runAgent({
  id,
  input,
  stateMd,
}: {
  id: AgentId;
  input: LogInput;
  stateMd: string;
}): Promise<AgentOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]);
  const client = new Anthropic({ apiKey });

  const userContent: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: { type: "url"; url: string };
      }
  > = [];
  if (input.imageUrl) {
    userContent.push({
      type: "image",
      source: { type: "url", url: input.imageUrl },
    });
  }
  userContent.push({
    type: "text",
    text: [
      `Locale: ${input.locale}`,
      `Timestamp: ${input.at}`,
      `Tags the router picked: ${input.tags.join(", ") || "(none)"}`,
      "",
      "Patient said:",
      input.text.trim() || "(no free text — input is image/numeric only)",
    ].join("\n"),
  });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: roleFor(id),
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text:
          stateMd.trim().length > 0
            ? `Your current state summary (state.md):\n\n${stateMd}`
            : "Your current state summary is empty — this is the first log you're seeing.",
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { format: zodOutputFormat(AgentOutputSchema) },
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error(`Agent ${id} returned no parsed output`);
  }
  return response.parsed_output as AgentOutput;
}
