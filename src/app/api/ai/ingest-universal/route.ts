import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  INGEST_SYSTEM,
  ingestDraftSchema,
} from "~/lib/ingest/draft-schema";
import type { PreparedImage } from "~/lib/ingest/image";
import type { IngestDraft, IngestSourceKind } from "~/types/ingest";

export const runtime = "nodejs";
// Smart-capture ingest can emit up to 25 ops per document, on Opus-4-7
// with a 4k-token budget + optional image input. The default 10–15s
// serverless timeout isn't enough — users were seeing
// FUNCTION_INVOCATION_TIMEOUT on longer clinic letters. 120s sits well
// under the Vercel Pro 300s cap and covers real-world docs.
export const maxDuration = 120;

interface RequestBody {
  text?: string;
  image?: PreparedImage;
  source: IngestSourceKind;
  today?: string;
  locale?: "en" | "zh";
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
  if (!body.source) {
    return NextResponse.json({ error: "source required" }, { status: 400 });
  }

  const today = body.today ?? new Date().toISOString().slice(0, 10);
  const locale = body.locale ?? "en";

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
  const prefix = `Today is ${today}. Respond with the structured plan. The patient's locale is ${locale}.`;
  if (body.text && body.text.trim().length > 0) {
    content.push({
      type: "text",
      text: body.image
        ? `${prefix}\n\nThe OCR layer also produced the following text — use it to cross-check the image:\n\n---\n${body.text}\n---`
        : `${prefix}\n\nDocument text:\n\n---\n${body.text}\n---`,
    });
  } else if (body.image) {
    content.push({
      type: "text",
      text: `${prefix}\n\nRead this medical document and emit the operations.`,
    });
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: body.model ?? "claude-opus-4-7",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: INGEST_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: jsonOutputFormat(ingestDraftSchema) },
      messages: [{ role: "user", content }],
    });
    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "No draft returned" },
        { status: 502 },
      );
    }
    const draft: IngestDraft = {
      source: body.source,
      ...response.parsed_output,
    };
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
