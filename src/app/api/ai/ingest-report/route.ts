import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
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
  const gate = getAnthropicClient();
  if (gate.error) return gate.error;

  const parsed = await readJsonBody<RequestBody>(req);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  if (!body?.text && !body?.image) {
    return NextResponse.json(
      { error: "text or image required" },
      { status: 400 },
    );
  }

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

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
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
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "Claude returned no parsed output" },
      { status: 502 },
    );
  }
  return NextResponse.json({ result: result.value.parsed_output });
}
