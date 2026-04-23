import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  ExtractionSchema,
  EXTRACTION_SYSTEM,
} from "~/lib/ingest/claude-parser";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
// Vision + Opus parse of a lab / imaging / clinic letter — routinely 15-30s.
export const maxDuration = 60;

interface RequestBody {
  text?: string;
  image?: PreparedImage;
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
  if (!body?.text && !body?.image) {
    return NextResponse.json(
      { error: "text or image required" },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  const content: Array<
    | { type: "text"; text: string }
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          data: string;
        };
      }
  > = [];
  if (body.image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: body.image.mediaType,
        data: body.image.base64,
      },
    });
  }
  if (body.text && body.text.trim().length > 0) {
    content.push({
      type: "text",
      text: body.image
        ? `The OCR layer also produced the following text. Use it to cross-check the image when values are unclear:\n\n---\n${body.text}\n---`
        : `Extract structured fields from the following OCR text:\n\n---\n${body.text}\n---`,
    });
  } else if (body.image) {
    content.push({
      type: "text",
      text: "Read this medical document and extract the structured fields.",
    });
  }

  try {
    const response = await client.messages.parse({
      model: body.model ?? "claude-opus-4-7",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: EXTRACTION_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(ExtractionSchema) },
      messages: [{ role: "user", content }],
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Claude returned no parsed output" },
        { status: 502 },
      );
    }
    return NextResponse.json({ result: response.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
