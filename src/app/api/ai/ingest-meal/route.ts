import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import { MealSchema, buildMealSystem } from "~/lib/ingest/meal-vision";
import { requireSession } from "~/lib/auth/require-session";
import { loadHouseholdProfile } from "~/lib/household/profile";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  image: PreparedImage;
  model?: string;
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.error;

  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.image?.base64 || !body.image.mediaType) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(auth.session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: buildMealSystem(profile),
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(MealSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.image.mediaType,
                data: body.image.base64,
              },
            },
            {
              type: "text",
              text: "Estimate the macros for this meal and, if relevant, the PERT dose.",
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "No meal estimate returned" },
      { status: 502 },
    );
  }
  return NextResponse.json({ result: result.value.parsed_output });
}
