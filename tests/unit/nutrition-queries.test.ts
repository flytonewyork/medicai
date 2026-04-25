import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  ensureFoodsSeeded,
  searchFoods,
  upsertFood,
  createMeal,
  listMealsForDate,
  listItemsForMeal,
  listMealsBetween,
  deleteMeal,
} from "~/lib/nutrition/queries";
import { recalcNetCarbs } from "~/lib/nutrition/calculator";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("ensureFoodsSeeded", () => {
  it("seeds the catalogue once and is idempotent", async () => {
    await ensureFoodsSeeded();
    const first = await db.foods.count();
    expect(first).toBeGreaterThan(20);
    await ensureFoodsSeeded();
    const second = await db.foods.count();
    expect(second).toBe(first);
  });

  it("computes net_carbs at seed time", async () => {
    await ensureFoodsSeeded();
    const all = await db.foods.toArray();
    for (const f of all) {
      expect(f.net_carbs_g).toBe(recalcNetCarbs(f));
    }
  });
});

describe("searchFoods", () => {
  it("matches by English name", async () => {
    await ensureFoodsSeeded();
    const results = await searchFoods("salmon");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain("salmon");
  });

  it("matches by Chinese name", async () => {
    await ensureFoodsSeeded();
    const results = await searchFoods("豆腐");
    expect(results.length).toBeGreaterThan(0);
  });

  it("supports keto-only filter", async () => {
    await ensureFoodsSeeded();
    const all = await searchFoods("rice");
    const ketoOnly = await searchFoods("rice", { ketoOnly: true });
    expect(all.length).toBeGreaterThan(ketoOnly.length);
    for (const f of ketoOnly) {
      expect(f.keto_friendly).toBe(true);
    }
  });
});

describe("upsertFood", () => {
  it("recomputes net_carbs on save", async () => {
    const id = await upsertFood({
      name: "Custom",
      category: "other",
      calories: 100,
      protein_g: 0,
      fat_g: 0,
      carbs_total_g: 30,
      fiber_g: 10,
      sugar_alcohols_g: 5,
      keto_friendly: false,
      tags: [],
      source: "custom",
    });
    const row = await db.foods.get(id);
    expect(row?.net_carbs_g).toBe(15);
  });
});

describe("createMeal", () => {
  it("logs a meal with item rows and snapshotted totals", async () => {
    await ensureFoodsSeeded();
    const food = (await searchFoods("egg"))[0];
    expect(food).toBeTruthy();

    const id = await createMeal({
      date: "2026-04-25",
      meal_type: "breakfast",
      source: "manual",
      entered_by: "hulin",
      items: [
        { kind: "food", food, serving_grams: 100 }, // 2 eggs ~100g
      ],
    });

    const meal = await db.meal_entries.get(id);
    expect(meal).toBeTruthy();
    expect(meal?.total_protein_g).toBeGreaterThan(10);

    const items = await listItemsForMeal(id);
    expect(items).toHaveLength(1);
    expect(items[0].food_id).toBe(food.id);
    expect(items[0].calories).toBeGreaterThan(0);
  });

  it("supports inline (AI-only) items", async () => {
    const id = await createMeal({
      date: "2026-04-25",
      meal_type: "dinner",
      source: "photo",
      confidence: "medium",
      entered_by: "hulin",
      items: [
        {
          kind: "inline",
          name: "Restaurant pho",
          serving_grams: 400,
          macros: {
            calories: 100, // per 100g
            protein_g: 8,
            fat_g: 2,
            carbs_total_g: 12,
            fiber_g: 1,
          },
        },
      ],
    });
    const items = await listItemsForMeal(id);
    expect(items[0].food_id).toBeUndefined();
    expect(items[0].food_name).toBe("Restaurant pho");
    expect(items[0].calories).toBeCloseTo(400, 0);
    expect(items[0].protein_g).toBeCloseTo(32, 1);
  });
});

describe("listMealsForDate / listMealsBetween", () => {
  it("returns meals ordered by meal_type then logged_at", async () => {
    await ensureFoodsSeeded();
    const food = (await searchFoods("egg"))[0];
    await createMeal({
      date: "2026-04-25",
      meal_type: "dinner",
      logged_at: "2026-04-25T19:00:00Z",
      source: "manual",
      entered_by: "hulin",
      items: [{ kind: "food", food, serving_grams: 100 }],
    });
    await createMeal({
      date: "2026-04-25",
      meal_type: "breakfast",
      logged_at: "2026-04-25T08:00:00Z",
      source: "manual",
      entered_by: "hulin",
      items: [{ kind: "food", food, serving_grams: 50 }],
    });
    const meals = await listMealsForDate("2026-04-25");
    expect(meals).toHaveLength(2);
    expect(meals[0].meal_type).toBe("breakfast");
    expect(meals[1].meal_type).toBe("dinner");
  });

  it("filters across a date range", async () => {
    await ensureFoodsSeeded();
    const food = (await searchFoods("egg"))[0];
    for (const d of ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"]) {
      await createMeal({
        date: d,
        meal_type: "lunch",
        source: "manual",
        entered_by: "hulin",
        items: [{ kind: "food", food, serving_grams: 50 }],
      });
    }
    const week = await listMealsBetween("2026-04-24", "2026-04-26");
    expect(week.map((m) => m.date).sort()).toEqual([
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
    ]);
  });
});

describe("deleteMeal", () => {
  it("removes the entry and its items", async () => {
    await ensureFoodsSeeded();
    const food = (await searchFoods("egg"))[0];
    const id = await createMeal({
      date: "2026-04-25",
      meal_type: "lunch",
      source: "manual",
      entered_by: "hulin",
      items: [{ kind: "food", food, serving_grams: 100 }],
    });
    expect(await listItemsForMeal(id)).toHaveLength(1);
    await deleteMeal(id);
    expect(await db.meal_entries.get(id)).toBeUndefined();
    expect(await listItemsForMeal(id)).toHaveLength(0);
  });
});
