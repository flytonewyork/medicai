"use client";

import { z } from "zod";
import type { PreparedImage } from "./image";

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
      "For PDAC patients: brief PERT (Creon) suggestion if the meal is fatty or rich — e.g. '25,000u with this meal'. Null if not applicable.",
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

const MEAL_SYSTEM = `You estimate the macronutrients of a meal from a single photo for Hu Lin, a patient with metastatic pancreatic adenocarcinoma on first-line gemcitabine + nab-paclitaxel.

Rules:
1. Keep estimates conservative; if unsure, err low on protein and say so in 'notes'.
2. Assume one adult portion unless obviously multiple servings.
3. For PDAC, flag fatty/rich meals with a practical PERT suggestion (e.g. '25,000u with this meal; 10,000u with any follow-up snack'). If low fat, set pert_suggestion to null.
4. If the photo is too unclear to judge (blur, distant, empty plate), set confidence=low and note what's missing.
5. Never invent specific brands or recipes. Describe what's visually present.`;

export async function estimateMeal({
  apiKey,
  model = "claude-opus-4-7",
  image,
}: {
  apiKey: string;
  model?: string;
  image: PreparedImage;
}): Promise<MealEstimate> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.parse({
    model,
    max_tokens: 1024,
    system: [
      { type: "text", text: MEAL_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    output_config: { format: zodOutputFormat(MealSchema) },
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
            text: "Estimate the macros for this meal and, if relevant, the PERT dose.",
          },
        ],
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("No meal estimate returned");
  }
  return response.parsed_output;
}
