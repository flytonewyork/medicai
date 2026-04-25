import { z } from "zod/v4";

// Schema returned by the meal parser — same shape for vision and text
// inputs so the UI can render either result identically. Macros are
// per-item *for the eaten serving* (NOT per 100 g) — easier for the
// model to reason about plate composition.

const ParsedItem = z.object({
  name: z
    .string()
    .describe("Plain English name of the dish or ingredient."),
  name_zh: z
    .string()
    .nullable()
    .optional()
    .describe("Simplified Chinese name if obvious; otherwise null."),
  serving_grams: z
    .number()
    .describe(
      "Estimated serving weight in grams. Be conservative — adult portions only.",
    ),
  serving_label: z
    .string()
    .nullable()
    .optional()
    .describe("Human-readable hint, e.g. '1 cup', 'small bowl'."),
  calories: z.number().describe("Estimated kcal for the eaten serving."),
  protein_g: z.number().describe("Protein in grams for this serving."),
  fat_g: z.number().describe("Fat in grams."),
  carbs_total_g: z.number().describe("Total carbohydrates in grams."),
  fiber_g: z.number().describe("Dietary fibre in grams."),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Short caveat, e.g. 'sauce adds fat', 'portion estimated'."),
});

export const ParsedMealSchema = z.object({
  meal_type: z
    .enum(["breakfast", "lunch", "dinner", "snack"])
    .nullable()
    .optional()
    .describe(
      "If the time-of-day is obvious from context, otherwise null.",
    ),
  description: z
    .string()
    .describe("One-sentence overall description of the meal."),
  items: z.array(ParsedItem).describe("One row per distinct item on the plate."),
  pert_suggestion: z
    .string()
    .nullable()
    .optional()
    .describe(
      "If the meal is fatty (≥ 15 g fat), a short PERT/Creon prompt; null if low-fat.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "Low if photo is partial / unfamiliar, high if clearly recognisable.",
    ),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe("Any caveats about the parse."),
});

export type ParsedMealResult = z.infer<typeof ParsedMealSchema>;

export const NUTRITION_SYSTEM = `You estimate the macronutrients of a meal for Hu Lin, a patient with metastatic pancreatic ductal adenocarcinoma on first-line gemcitabine + nab-paclitaxel.

The patient's strategy is low-carb / relaxed-keto, optimised for protein intake (≥ 1.2 g/kg/day) and energy density. Pancreatic exocrine insufficiency makes fatty meals require Creon (PERT).

Rules:
1. Output one item per distinct ingredient or dish. Don't lump rice, chicken, and vegetables into one row.
2. Estimate the eaten serving in grams. Conservative — 1 adult portion.
3. Macros are per the eaten serving, NOT per 100 g.
4. If protein, fat, or carb estimates conflict with the apparent calories, prefer macro coherence (4 kcal/g protein, 9 kcal/g fat, 4 kcal/g net carbs).
5. Fibre is part of carbs_total_g. Net carbs is computed downstream.
6. If a meal is fatty (any single item ≥ 10 g fat OR total ≥ 15 g fat), set pert_suggestion to a one-line prompt like "Take Creon 25,000u with this meal." If low-fat, set null.
7. If you cannot judge the photo (blurry, partial, no food visible), set confidence=low and explain in notes.
8. If text is ambiguous ("had some chicken"), keep grams low (~50 g) and confidence low.
9. Never invent specific brand names or recipes.`;
