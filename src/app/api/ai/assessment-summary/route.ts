import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { buildSummarySystem } from "~/lib/ai/coach";
import { requireSession } from "~/lib/auth/require-session";
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
  const auth = await requireSession();
  if (!auth.ok) return auth.error;

  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.assessment) {
    return NextResponse.json(
      { error: "assessment required" },
      { status: 400 },
    );
  }

  const profile = await loadHouseholdProfile(auth.session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.parse({
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
}
