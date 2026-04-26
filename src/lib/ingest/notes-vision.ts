import { z } from "zod/v4";
import type { PreparedImage } from "./image";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";

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

export function buildNotesSystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  return `You're reading a photo of ${profile.patient_initials}'s handwritten daily notes from a cancer-tracking journal and structuring them into Anchor's daily-log fields.

Rules:
1. First transcribe the note faithfully — no rewording, no added words, no interpretation.
2. Then populate daily_patch with ONLY the fields the user explicitly wrote about.
3. Scales default to 0–10 (0 = none, 10 = worst). Convert loose language conservatively: "mild pain" → 2–3, "moderate" → 4–6, "severe" → 7–9, "unbearable" → 10.
4. If a number is ambiguous (e.g. "pain 4 or 5"), pick the lower value and list the ambiguity.
5. For practice completion: only set true if the note says the practice was done today.
6. Never invent metrics. If the note doesn't mention something, omit it (leave absent / null).
7. Put any free-text reflection (non-metric sentences) into the 'reflection' field.`;
}

export async function structureNotes({
  model = DEFAULT_AI_MODEL,
  image,
}: {
  model?: string;
  image: PreparedImage;
}): Promise<NotesStructure> {
  const res = await fetch("/api/ai/ingest-notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, model }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { result: NotesStructure };
  return data.result;
}
