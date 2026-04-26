import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  getAnthropicClient,
  readJsonBody,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import {
  INGEST_SYSTEM,
  ingestDraftSchema,
} from "~/lib/ingest/draft-schema";
import type { PreparedImage } from "~/lib/ingest/image";
import { todayISO } from "~/lib/utils/date";
import type { IngestDraft, IngestSourceKind } from "~/types/ingest";

export const runtime = "nodejs";
// Smart-capture ingest can emit up to 25 ops per document on Opus-4-7
// with a 4k-token budget + optional image input. 60s is the safe
// ceiling across all Vercel paid tiers without needing Fluid Compute;
// complex multi-page clinic letters that still time out should be
// split or downgraded to Sonnet per-route rather than pushing the
// platform cap higher.
export const maxDuration = 60;

interface RequestBody {
  text?: string;
  image?: PreparedImage;
  source: IngestSourceKind;
  today?: string;
  locale?: "en" | "zh";
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
  if (!body.source) {
    return NextResponse.json({ error: "source required" }, { status: 400 });
  }

  const today = body.today ?? todayISO();
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

  const result = await withAnthropicErrorBoundary(() =>
    gate.client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
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
    }),
  );
  if (result.error) return result.error;

  if (!result.value.parsed_output) {
    return NextResponse.json(
      { error: "No draft returned" },
      { status: 502 },
    );
  }
  const draft: IngestDraft = {
    source: body.source,
    ...result.value.parsed_output,
  };
  return NextResponse.json({ draft });
}
