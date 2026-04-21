"use client";

import { z } from "zod";
import type { PreparedImage } from "./image";

export const NotesStructureSchema = z.object({
  transcription: z
    .string()
    .describe("Faithful transcription of the note as written. No additions."),
  daily_patch: z
    .object({
      energy: z.number().min(0).max(10).nullable().optional(),
      sleep_quality: z.number().min(0).max(10).nullable().optional(),
      appetite: z.number().min(0).max(10).nullable().optional(),
      pain_worst: z.number().min(0).max(10).nullable().optional(),
      pain_current: z.number().min(0).max(10).nullable().optional(),
      nausea: z.number().min(0).max(10).nullable().optional(),
      mood_clarity: z.number().min(0).max(10).nullable().optional(),
      weight_kg: z.number().nullable().optional(),
      diarrhoea_count: z.number().int().nullable().optional(),
      fever: z.boolean().nullable().optional(),
      fever_temp: z.number().nullable().optional(),
      protein_grams: z.number().nullable().optional(),
      walking_minutes: z.number().nullable().optional(),
      practice_morning_completed: z.boolean().nullable().optional(),
      practice_evening_completed: z.boolean().nullable().optional(),
      reflection: z.string().nullable().optional(),
    })
    .describe(
      "Structured patch onto today's daily entry. Include ONLY fields the user actually wrote about; leave everything else absent or null.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("Overall confidence in the transcription and structuring."),
  ambiguities: z
    .array(z.string())
    .default([])
    .describe(
      "List specific phrases or numbers you were uncertain about, each with what you interpreted.",
    ),
});

export type NotesStructure = z.infer<typeof NotesStructureSchema>;

const NOTES_SYSTEM = `You're reading a photo of Hu Lin's handwritten daily notes from his cancer-tracking journal and structuring them into Anchor's daily-log fields.

Rules:
1. First transcribe the note faithfully — no rewording, no added words, no interpretation.
2. Then populate daily_patch with ONLY the fields the user explicitly wrote about.
3. Scales default to 0–10 (0 = none, 10 = worst). Convert loose language conservatively: "mild pain" → 2–3, "moderate" → 4–6, "severe" → 7–9, "unbearable" → 10.
4. If a number is ambiguous (e.g. "pain 4 or 5"), pick the lower value and list the ambiguity.
5. For practice completion: only set true if the note says the practice was done today.
6. Never invent metrics. If the note doesn't mention something, omit it (leave absent / null).
7. Put any free-text reflection (non-metric sentences) into the 'reflection' field.`;

export async function structureNotes({
  apiKey,
  model = "claude-opus-4-7",
  image,
}: {
  apiKey: string;
  model?: string;
  image: PreparedImage;
}): Promise<NotesStructure> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.parse({
    model,
    max_tokens: 1500,
    system: [
      { type: "text", text: NOTES_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: { format: zodOutputFormat(NotesStructureSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType,
              data: image.base64,
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
    throw new Error("No notes structure returned");
  }
  return response.parsed_output;
}
