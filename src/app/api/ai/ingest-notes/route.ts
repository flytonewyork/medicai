import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import {
  NotesStructureSchema,
  NOTES_SYSTEM,
} from "~/lib/ingest/notes-vision";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  image: PreparedImage;
  model?: string;
}

export async function POST(req: Request) {
  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.image?.base64 || !body.image.mediaType) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
      max_tokens: 1500,
      system: [
        { type: "text", text: NOTES_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      output_config: { format: jsonOutputFormat(NotesStructureSchema) },
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
              text: "Transcribe this note and structure it into Anchor's daily log fields.",
            },
          ],
        },
      ],
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "No notes structure returned" },
      { status: 502 },
    );
  }
  return NextResponse.json({ result: result.value.parsed_output });
}
