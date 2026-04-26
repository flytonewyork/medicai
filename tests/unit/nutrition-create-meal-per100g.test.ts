import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { createMeal } from "~/lib/nutrition/queries";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// `createMeal`'s `inline` items expect macros in the canonical AU/EU
// per-100 g frame (matching `FoodItem.calories` etc.). Serving grams
// scale them at save time. These tests pin that contract: passing
// per-100 g values + a serving_grams comes back scaled correctly.

describe("createMeal — inline macros are per-100 g", () => {
  it("scales per-100 g macros to the serving size", async () => {
    const id = await createMeal({
      date: "2026-04-26",
      meal_type: "breakfast",
      source: "text",
      entered_by: "hulin",
      items: [
        {
          kind: "inline",
          name: "Plain yoghurt",
          serving_grams: 200,
          macros: {
            calories: 100,
            protein_g: 5,
            fat_g: 4,
            carbs_total_g: 6,
            fiber_g: 0,
          },
        },
      ],
    });
    const items = await db.meal_items
      .where("meal_entry_id")
      .equals(id)
      .toArray();
    expect(items.length).toBe(1);
    // 200 g serving × per-100 g macros = doubled values
    expect(items[0].calories).toBe(200);
    expect(items[0].protein_g).toBe(10);
    expect(items[0].fat_g).toBe(8);
    expect(items[0].carbs_total_g).toBe(12);
  });

  it("totals on the meal_entry match the scaled item macros", async () => {
    const id = await createMeal({
      date: "2026-04-26",
      meal_type: "lunch",
      source: "text",
      entered_by: "hulin",
      items: [
        {
          kind: "inline",
          name: "Avocado",
          serving_grams: 150,
          macros: {
            calories: 160,
            protein_g: 2,
            fat_g: 15,
            carbs_total_g: 8.5,
            fiber_g: 6.7,
          },
        },
      ],
    });
    const meal = await db.meal_entries.get(id);
    expect(meal).toBeDefined();
    // 150 / 100 = 1.5 ×
    expect(meal!.total_calories).toBe(240);
    expect(meal!.total_protein_g).toBe(3);
    expect(meal!.total_fat_g).toBeCloseTo(22.5, 1);
  });
});
