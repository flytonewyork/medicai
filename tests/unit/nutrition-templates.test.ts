import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  ensureFoodsSeeded,
  searchFoods,
  createMeal,
  listItemsForMeal,
} from "~/lib/nutrition/queries";
import {
  saveMealAsTemplate,
  listTemplates,
  logTemplate,
  relogMeal,
  deleteTemplate,
} from "~/lib/nutrition/templates";

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureFoodsSeeded();
});

async function aLoggedMeal(date = "2026-04-25") {
  const food = (await searchFoods("egg"))[0]!;
  return createMeal({
    date,
    meal_type: "breakfast",
    source: "manual",
    entered_by: "hulin",
    items: [{ kind: "food", food, serving_grams: 100 }],
    notes: "Morning eggs",
  });
}

describe("saveMealAsTemplate", () => {
  it("snapshots items and totals", async () => {
    const mealId = await aLoggedMeal();
    const tplId = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "Usual breakfast",
    });
    const tpl = await db.meal_templates.get(tplId);
    expect(tpl?.name).toBe("Usual breakfast");
    expect(tpl?.use_count).toBe(0);
    expect(tpl?.items.length).toBe(1);
    expect(tpl?.items[0].food_name.toLowerCase()).toContain("egg");
    expect(tpl?.items[0].serving_grams).toBe(100);
    expect(tpl?.items[0].calories).toBeGreaterThan(0);
  });
});

describe("listTemplates", () => {
  it("orders by recent (last_used_at) by default", async () => {
    const mealId = await aLoggedMeal();
    const a = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "A",
    });
    const b = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "B",
    });
    await new Promise((r) => setTimeout(r, 5));
    await db.meal_templates.update(a, {
      last_used_at: new Date().toISOString(),
    });
    const recent = await listTemplates({ orderBy: "recent" });
    expect(recent[0].id).toBe(a);
    void b;
  });

  it("orders by use_count for favourites", async () => {
    const mealId = await aLoggedMeal();
    const a = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "A",
    });
    const b = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "B",
    });
    await db.meal_templates.update(b, { use_count: 5 });
    const favs = await listTemplates({ orderBy: "favourites" });
    expect(favs[0].id).toBe(b);
    void a;
  });
});

describe("logTemplate", () => {
  it("creates a fresh meal with template's items + bumps use_count", async () => {
    const sourceMeal = await aLoggedMeal();
    const tplId = await saveMealAsTemplate({
      meal_entry_id: sourceMeal,
      name: "Usual breakfast",
    });
    const newMealId = await logTemplate({
      template_id: tplId,
      date: "2026-04-26",
      entered_by: "hulin",
    });
    const items = await listItemsForMeal(newMealId);
    expect(items).toHaveLength(1);
    expect(items[0].food_name.toLowerCase()).toContain("egg");
    expect(items[0].serving_grams).toBe(100);

    const tpl = await db.meal_templates.get(tplId);
    expect(tpl?.use_count).toBe(1);
    expect(tpl?.last_used_at).toBeTruthy();

    const newMeal = await db.meal_entries.get(newMealId);
    expect(newMeal?.date).toBe("2026-04-26");
  });

  it("preserves macros after re-log (round-trip stability)", async () => {
    const sourceMeal = await aLoggedMeal();
    const sourceItems = await listItemsForMeal(sourceMeal);
    const sourceProtein = sourceItems[0].protein_g;

    const tplId = await saveMealAsTemplate({
      meal_entry_id: sourceMeal,
      name: "Usual breakfast",
    });
    const newMealId = await logTemplate({
      template_id: tplId,
      date: "2026-04-26",
      entered_by: "hulin",
    });
    const newItems = await listItemsForMeal(newMealId);
    expect(newItems[0].protein_g).toBeCloseTo(sourceProtein, 1);
    expect(newItems[0].serving_grams).toBe(sourceItems[0].serving_grams);
  });
});

describe("relogMeal", () => {
  it("copies a past meal forward to a new date", async () => {
    const sourceMeal = await aLoggedMeal("2026-04-24");
    const newMealId = await relogMeal({
      source_meal_id: sourceMeal,
      date: "2026-04-25",
      entered_by: "hulin",
    });
    const newMeal = await db.meal_entries.get(newMealId);
    expect(newMeal?.date).toBe("2026-04-25");
    const items = await listItemsForMeal(newMealId);
    expect(items).toHaveLength(1);
    expect(items[0].food_name.toLowerCase()).toContain("egg");
  });
});

describe("deleteTemplate", () => {
  it("removes the row", async () => {
    const mealId = await aLoggedMeal();
    const id = await saveMealAsTemplate({
      meal_entry_id: mealId,
      name: "Usual",
    });
    await deleteTemplate(id);
    expect(await db.meal_templates.get(id)).toBeUndefined();
  });
});
