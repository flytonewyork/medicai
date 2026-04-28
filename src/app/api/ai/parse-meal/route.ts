import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  createClaudeRoute,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import {
  ParsedMealSchema,
  buildNutritionSystem,
} from "~/lib/nutrition/parser-schema";
import { loadHouseholdProfile } from "~/lib/household/profile";
import { wrapUserInput } from "~/lib/anthropic/wrap-user-input";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PhotoBody {
  kind: "photo";
  image: PreparedImage;
  model?: string;
  locale?: "en" | "zh";
}
interface TextBody {
  kind: "text";
  text: string;
  model?: string;
  locale?: "en" | "zh";
}
type RequestBody = PhotoBody | TextBody;

export const POST = createClaudeRoute<RequestBody>(async ({ body, client, session }) => {
  if (!body || (body.kind !== "photo" && body.kind !== "text")) {
    return NextResponse.json(
      { error: "kind must be 'photo' or 'text'" },
      { status: 400 },
    );
  }
  if (body.kind === "photo" && (!body.image?.base64 || !body.image.mediaType)) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }
  if (body.kind === "text" && !body.text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(session.household_id);
  const localeNote =
    body.locale === "zh"
      ? "Reply in English keys, but populate name_zh for every item."
      : "name_zh is optional; only populate when obvious (e.g. Chinese dish).";

  const result = await withAnthropicErrorBoundary(() =>
    client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: `${buildNutritionSystem(profile)}\n\n${localeNote}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(ParsedMealSchema) },
      messages:
        body.kind === "photo"
          ? [
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
                    text: "Estimate the macros for everything visible on the plate. List each distinct item separately.",
                  },
                ],
              },
            ]
          : [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: wrapUserInput(
                      "Parse the meal description into structured items",
                      body.text,
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
      { error: "No meal estimate returned" },
      { status: 502 },
    );
  }
  return NextResponse.json({ result: result.value.parsed_output });
});
