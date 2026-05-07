import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  gateAiRequest,
  requireParsedOutput,
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

export async function POST(req: Request) {
  const ctx = await gateAiRequest<RequestBody>(req);
  if (ctx.error) return ctx.error;

  if (!ctx.body?.assessment) {
    return NextResponse.json(
      { error: "assessment required" },
      { status: 400 },
    );
  }

  const profile = await loadHouseholdProfile(ctx.session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    ctx.client.messages.parse({
      model: ctx.body.model ?? DEFAULT_AI_MODEL,
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
                  assessment: ctx.body.assessment,
                  prior_assessment: ctx.body.prior_assessment ?? null,
                }),
              ),
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  const parsed = requireParsedOutput(result.value, "No summary returned");
  if (parsed.error) return parsed.error;
  return NextResponse.json({ result: parsed.value });
}
