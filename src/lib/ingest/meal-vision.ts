import { z } from "zod/v4";
import type { PreparedImage } from "./image";
import { DEFAULT_AI_MODEL } from "~/lib/anthropic/model";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";

export const MealSchema = z.object({
  description: z
    .string()
    .describe("One-sentence description of what's on the plate."),
  protein_g: z.number().describe("Estimated protein in grams."),
  carbs_g: z.number().describe("Estimated carbohydrates in grams."),
  fat_g: z.number().describe("Estimated fat in grams."),
  calories: z.number().describe("Estimated calories in kcal."),
  pert_suggestion: z
    .string()
    .nullable()
    .optional()
    .describe(
      "For pancreatic-insufficiency patients: brief PERT (Creon) suggestion if the meal is fatty or rich — e.g. '25,000u with this meal'. Null if not applicable.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "How confident the estimate is. Low = generic plate, partial view, or unfamiliar dish.",
    ),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Any caveats, e.g. 'portion estimated', 'sauce adds fat', 'no protein visible'.",
    ),
});

export type MealEstimate = z.infer<typeof MealSchema>;

export function buildMealSystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  return `You estimate the macronutrients of a meal from a single photo for ${profile.patient_initials}, a patient with ${profile.diagnosis_full}.

Rules:
1. Keep estimates conservative; if unsure, err low on protein and say so in 'notes'.
2. Assume one adult portion unless obviously multiple servings.
3. For pancreatic exocrine insufficiency, flag fatty/rich meals with a practical PERT suggestion (e.g. '25,000u with this meal; 10,000u with any follow-up snack'). If low fat, set pert_suggestion to null.
4. If the photo is too unclear to judge (blur, distant, empty plate), set confidence=low and note what's missing.
5. Never invent specific brands or recipes. Describe what's visually present.`;
}

// Client-side shim. Posts the image to /api/ai/ingest-meal which holds
// the server-side ANTHROPIC_API_KEY. Kept as a named export with the
// same signature as before, minus the apiKey parameter.
export async function estimateMeal({
  model = DEFAULT_AI_MODEL,
  image,
}: {
  model?: string;
  image: PreparedImage;
}): Promise<MealEstimate> {
  const res = await fetch("/api/ai/ingest-meal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, model }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = (await res.json()) as { result: MealEstimate };
  return data.result;
}
