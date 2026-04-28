import { NextResponse } from "next/server";
import { jsonOutputFormat } from "~/lib/anthropic/json-output";
import {
  DEFAULT_AI_MODEL,
  createClaudeRoute,
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

export const POST = createClaudeRoute<RequestBody>(async ({ body, client, session }) => {
  if (!body?.image?.base64 || !body.image.mediaType) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const profile = await loadHouseholdProfile(session.household_id);

  const result = await withAnthropicErrorBoundary(() =>
    client.messages.parse({
      model: body.model ?? DEFAULT_AI_MODEL,
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
});
