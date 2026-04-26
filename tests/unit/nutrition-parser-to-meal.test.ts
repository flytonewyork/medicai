import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { createMeal } from "~/lib/nutrition/queries";
import { parsedItemToInline } from "~/lib/nutrition/parser-to-meal";
import type { ParsedMealResult } from "~/lib/nutrition/parser-schema";

// The AI parser emits per-eaten-serving macros (per parser-schema:
// "Macros are per-item *for the eaten serving* (NOT per 100 g)").
// `createMeal` expects per-100 g macros for `inline` items. Without
// conversion the values get double-scaled (the bug we're fixing).
// `parsedItemToInline` is the bridge — it normalises the parser's
// per-serving output into the per-100 g convention.

type ParsedItem = ParsedMealResult["items"][number];

describe("parsedItemToInline — per-serving → per-100 g", () => {
  it("divides each macro by serving_grams / 100", () => {
    const parsed: ParsedItem = {
      name: "Avocado",
      serving_grams: 200,
      // parser per-serving values (200 g of avocado)
      calories: 320,
      protein_g: 4,
      fat_g: 30,
      carbs_total_g: 17,
      fiber_g: 13,
    };
    const inline = parsedItemToInline(parsed);
    expect(inline.kind).toBe("inline");
    expect(inline.serving_grams).toBe(200);
    // per-100 g = per-serving / 2
    expect(inline.macros.calories).toBe(160);
    expect(inline.macros.protein_g).toBe(2);
    expect(inline.macros.fat_g).toBe(15);
    expect(inline.macros.carbs_total_g).toBe(8.5);
    expect(inline.macros.fiber_g).toBe(6.5);
  });

  it("round-trips through createMeal back to the original per-serving", async () => {
    await db.delete();
    await db.open();
    const parsed: ParsedItem = {
      name: "Salmon fillet",
      serving_grams: 150,
      calories: 312,
      protein_g: 31,
      fat_g: 19,
      carbs_total_g: 0,
      fiber_g: 0,
    };
    const inline = parsedItemToInline(parsed);
    const id = await createMeal({
      date: "2026-04-26",
      meal_type: "dinner",
      source: "photo",
      entered_by: "hulin",
      items: [inline],
    });
    const items = await db.meal_items
      .where("meal_entry_id")
      .equals(id)
      .toArray();
    // After createMeal scales per-100 g back up to serving_grams,
    // we should get the parser's original per-serving values back —
    // within 1dp rounding noise from the two-step normalisation.
    expect(items[0].calories).toBeCloseTo(312, 0);
    expect(items[0].protein_g).toBeCloseTo(31, 0);
    expect(items[0].fat_g).toBeCloseTo(19, 0);
  });

  it("clamps tiny serving sizes to avoid divide-by-zero", () => {
    const inline = parsedItemToInline({
      name: "Trace garnish",
      serving_grams: 0,
      calories: 5,
      protein_g: 0,
      fat_g: 0,
      carbs_total_g: 1,
      fiber_g: 0,
    });
    expect(inline.serving_grams).toBeGreaterThan(0);
    expect(Number.isFinite(inline.macros.calories)).toBe(true);
  });

  it("preserves name + name_zh + notes", () => {
    const inline = parsedItemToInline({
      name: "Mapo tofu",
      name_zh: "麻婆豆腐",
      serving_grams: 200,
      calories: 240,
      protein_g: 14,
      fat_g: 16,
      carbs_total_g: 8,
      fiber_g: 2,
      notes: "Spicy — may aggravate ulcers",
    });
    expect(inline.name).toBe("Mapo tofu");
    expect(inline.name_zh).toBe("麻婆豆腐");
    expect(inline.notes).toMatch(/spicy/i);
  });
});
