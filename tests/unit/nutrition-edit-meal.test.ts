import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  ensureFoodsSeeded,
  searchFoods,
  createMeal,
  listItemsForMeal,
  updateMeal,
  updateMealItemServing,
  deleteMealItem,
} from "~/lib/nutrition/queries";

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureFoodsSeeded();
});

async function aMeal(date = "2026-04-25", grams = 100) {
  const food = (await searchFoods("egg"))[0]!;
  return createMeal({
    date,
    meal_type: "breakfast",
    logged_at: "2026-04-25T08:00:00Z",
    source: "manual",
    entered_by: "hulin",
    items: [{ kind: "food", food, serving_grams: grams }],
    notes: "two eggs",
  });
}

describe("updateMeal", () => {
  it("changes logged_at + meal_type + notes + date", async () => {
    const id = await aMeal("2026-04-25");
    await updateMeal({
      meal_entry_id: id,
      date: "2026-04-24",
      meal_type: "snack",
      logged_at: "2026-04-24T15:30:00Z",
      notes: "actually a snack yesterday",
    });
    const row = await db.meal_entries.get(id);
    expect(row?.date).toBe("2026-04-24");
    expect(row?.meal_type).toBe("snack");
    expect(row?.logged_at).toBe("2026-04-24T15:30:00Z");
    expect(row?.notes).toBe("actually a snack yesterday");
  });

  it("clears notes when passed null", async () => {
    const id = await aMeal();
    await updateMeal({ meal_entry_id: id, notes: null });
    const row = await db.meal_entries.get(id);
    expect(row?.notes).toBeUndefined();
  });

  it("toggles pert_taken + pert_units", async () => {
    const id = await aMeal();
    await updateMeal({
      meal_entry_id: id,
      pert_taken: true,
      pert_units: 25000,
    });
    let row = await db.meal_entries.get(id);
    expect(row?.pert_taken).toBe(true);
    expect(row?.pert_units).toBe(25000);

    await updateMeal({
      meal_entry_id: id,
      pert_taken: false,
      pert_units: null,
    });
    row = await db.meal_entries.get(id);
    expect(row?.pert_taken).toBe(false);
    expect(row?.pert_units).toBeUndefined();
  });
});

describe("updateMealItemServing", () => {
  it("recomputes per-item macros + parent totals", async () => {
    const id = await aMeal("2026-04-25", 100);
    const items = await listItemsForMeal(id);
    const itemId = items[0].id!;
    const beforeProtein = items[0].protein_g;
    const beforeCalories = items[0].calories;

    await updateMealItemServing({ meal_item_id: itemId, serving_grams: 200 });

    const updatedItem = await db.meal_items.get(itemId);
    expect(updatedItem?.serving_grams).toBe(200);
    // Macros should roughly double.
    expect(updatedItem?.protein_g).toBeCloseTo(beforeProtein * 2, 1);
    expect(updatedItem?.calories).toBeCloseTo(beforeCalories * 2, 0);

    // Parent totals snapshot is recomputed.
    const meal = await db.meal_entries.get(id);
    expect(meal?.total_protein_g).toBeCloseTo(updatedItem!.protein_g, 1);
    expect(meal?.total_calories).toBeCloseTo(updatedItem!.calories, 0);
  });

  it("falls back to scaling stored macros when food row is gone", async () => {
    const id = await aMeal("2026-04-25", 100);
    const items = await listItemsForMeal(id);
    const itemId = items[0].id!;
    const foodId = items[0].food_id!;
    const before = items[0].protein_g;

    // Delete the underlying food row.
    await db.foods.delete(foodId);

    await updateMealItemServing({ meal_item_id: itemId, serving_grams: 50 });

    const updated = await db.meal_items.get(itemId);
    expect(updated?.serving_grams).toBe(50);
    // Halved compared to the previous 100g.
    expect(updated?.protein_g).toBeCloseTo(before / 2, 1);
  });
});

describe("deleteMealItem", () => {
  it("removes item and recomputes totals", async () => {
    const id = await aMeal();
    const items = await listItemsForMeal(id);
    expect(items).toHaveLength(1);

    await deleteMealItem(items[0].id!);
    expect(await listItemsForMeal(id)).toHaveLength(0);

    const meal = await db.meal_entries.get(id);
    expect(meal?.total_protein_g).toBe(0);
    expect(meal?.total_calories).toBe(0);
  });
});
