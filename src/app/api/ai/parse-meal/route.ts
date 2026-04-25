import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  ParsedMealSchema,
  NUTRITION_SYSTEM,
} from "~/lib/nutrition/parser-schema";
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

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
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

  const client = new Anthropic({ apiKey });
  const localeNote =
    body.locale === "zh"
      ? "Reply in English keys, but populate name_zh for every item."
      : "name_zh is optional; only populate when obvious (e.g. Chinese dish).";

  try {
    const response = await client.messages.parse({
      model: body.model ?? "claude-opus-4-7",
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: `${NUTRITION_SYSTEM}\n\n${localeNote}`,
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
                    text: `Parse this meal description into structured items:\n\n${body.text}`,
                  },
                ],
              },
            ],
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "No meal estimate returned" },
        { status: 502 },
      );
    }
    return NextResponse.json({ result: response.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
