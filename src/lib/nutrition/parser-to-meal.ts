import type { ParsedMealResult } from "./parser-schema";
import type { CreateMealInput } from "./queries";

// Converts an AI-parsed meal item — whose macros are documented as
// per-eaten-serving (parser-schema.ts top comment) — into an
// `inline` shape that `createMeal` expects, where macros are per
// 100 g (the canonical AU/EU frame matching FoodItem). Without this
// bridge, the per-serving values get double-scaled by createMeal's
// `serving_grams / 100` multiplier.

type ParsedItem = ParsedMealResult["items"][number];
type InlineItem = Extract<CreateMealInput["items"][number], { kind: "inline" }>;

const MIN_SERVING_G = 1;

export function parsedItemToInline(p: ParsedItem): InlineItem {
  const grams = Math.max(MIN_SERVING_G, Math.round(p.serving_grams ?? 0));
  const f = 100 / grams;
  return {
    kind: "inline",
    name: p.name,
    name_zh: p.name_zh ?? undefined,
    serving_grams: grams,
    macros: {
      calories: round1(p.calories * f),
      protein_g: round1(p.protein_g * f),
      fat_g: round1(p.fat_g * f),
      carbs_total_g: round1(p.carbs_total_g * f),
      fiber_g: round1(p.fiber_g * f),
    },
    notes: p.notes ?? undefined,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
