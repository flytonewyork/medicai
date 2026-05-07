import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  gateAiRequest,
  requireParsedOutput,
  withAnthropicErrorBoundary,
} from "~/lib/anthropic/route-helpers";
import {
  NotesStructureSchema,
  buildNotesSystem,
} from "~/lib/ingest/notes-vision";
import { loadHouseholdProfile } from "~/lib/household/profile";
import type { PreparedImage } from "~/lib/ingest/image";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  image: PreparedImage;
  model?: string;
}

export async function POST(req: Request) {
  const ctx = await gateAiRequest<RequestBody>(req);
  if (ctx.error) return ctx.error;

  if (!ctx.body?.image?.base64 || !ctx.body.image.mediaType) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(ctx.session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    ctx.client.messages.parse({
      model: ctx.body.model ?? DEFAULT_AI_MODEL,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: buildNotesSystem(profile),
          cache_control: { type: "ephemeral" },
        },
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
                media_type: ctx.body.image.mediaType,
                data: ctx.body.image.base64,
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

  const parsed = requireParsedOutput(result.value, "No notes structure returned");
  if (parsed.error) return parsed.error;
  return NextResponse.json({ result: parsed.value });
}
