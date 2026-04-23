import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import { MealSchema, MEAL_SYSTEM } from "~/lib/ingest/meal-vision";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";

interface RequestBody {
  image: PreparedImage;
  model?: string;
}

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
  if (!body?.image?.base64 || !body.image.mediaType) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: body.model ?? "claude-opus-4-7",
      max_tokens: 1024,
      system: [
        { type: "text", text: MEAL_SYSTEM, cache_control: { type: "ephemeral" } },
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
