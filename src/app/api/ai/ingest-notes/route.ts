import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  NotesStructureSchema,
  NOTES_SYSTEM,
} from "~/lib/ingest/notes-vision";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "No notes structure returned" },
        { status: 502 },
      );
    }
    return NextResponse.json({ result: response.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
