import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  createClaudeRoute,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { buildSummarySystem } from "~/lib/ai/coach";
import { loadHouseholdProfile } from "~/lib/household/profile";
import { wrapUserInputBlock } from "~/lib/anthropic/wrap-user-input";

export const runtime = "nodejs";
export const maxDuration = 60;

const SummarySchema = z.object({
  patient: z.string(),
  clinician: z.string(),
});

interface RequestBody {
  model?: string;
  assessment: Record<string, unknown>;
  prior_assessment?: Record<string, unknown> | null;
}

export const POST = createClaudeRoute<RequestBody>(async ({ body, client, session }) => {
  if (!body?.assessment) {
    return NextResponse.json(
      { error: "assessment required" },
      { status: 400 },
    );
  }

  const profile = await loadHouseholdProfile(session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: buildSummarySystem(profile),
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(SummarySchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: wrapUserInputBlock(
                JSON.stringify({
                  assessment: body.assessment,
                  prior_assessment: body.prior_assessment ?? null,
                }),
              ),
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "No summary returned" },
      { status: 502 },
    );
  }
  return NextResponse.json({ result: result.value.parsed_output });
});
