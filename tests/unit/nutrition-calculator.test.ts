import { describe, it, expect } from "vitest";
import {
  netCarbs,
  recalcNetCarbs,
  scaleByGrams,
  sumItems,
  sumEntries,
  defaultTargets,
  foodHint,
  caloriesFromMacros,
  shouldPromptPert,
  PERT_FAT_THRESHOLD_G,
} from "~/lib/nutrition/calculator";
import type { FoodItem, MealEntry, MealItem } from "~/types/nutrition";

const baseFood: FoodItem = {
  id: 1,
  name: "Chicken thigh",
  category: "protein",
  calories: 247,
  protein_g: 25.9,
  fat_g: 15.5,
  carbs_total_g: 0,
  fiber_g: 0,
  net_carbs_g: 0,
  keto_friendly: true,
  tags: [],
  source: "seed",
  created_at: "",
  updated_at: "",
};

describe("netCarbs", () => {
  it("subtracts fibre and sugar alcohols from total carbs", () => {
    expect(netCarbs(20, 5, 3)).toBe(12);
  });
  it("clamps to zero when fibre > total (label rounding)", () => {
    expect(netCarbs(2.0, 2.5)).toBe(0);
  });
  it("rounds to 1dp", () => {
    expect(netCarbs(10.33, 2.11)).toBe(8.2);
  });
});

describe("recalcNetCarbs", () => {
  it("computes from macro shape", () => {
    const m = {
      calories: 100,
      protein_g: 5,
      fat_g: 2,
      carbs_total_g: 12,
      fiber_g: 4,
      sugar_alcohols_g: 1,
    };
    expect(recalcNetCarbs(m)).toBe(7);
  });
});

describe("scaleByGrams", () => {
  it("scales linearly to portion weight", () => {
    const out = scaleByGrams(
      { ...baseFood, net_carbs_g: 0 },
      200,
    );
    expect(out.calories).toBe(494);
    expect(out.protein_g).toBeCloseTo(51.8, 1);
    expect(out.fat_g).toBeCloseTo(31, 1);
  });
  it("returns zeros for non-positive grams", () => {
    expect(scaleByGrams(baseFood, 0).calories).toBe(0);
    expect(scaleByGrams(baseFood, -10).calories).toBe(0);
  });
  it("handles fractional grams", () => {
    const out = scaleByGrams(baseFood, 50);
    expect(out.calories).toBe(124); // 247/2 = 123.5 → 124 rounded
    expect(out.protein_g).toBeCloseTo(13, 0);
  });
});

describe("sumItems", () => {
  it("sums macros across items", () => {
    const items: MealItem[] = [
      mockItem({ calories: 200, protein_g: 20, fat_g: 10, net_carbs_g: 5, fiber_g: 1, carbs_total_g: 6 }),
      mockItem({ calories: 100, protein_g: 5, fat_g: 8, net_carbs_g: 2, fiber_g: 2, carbs_total_g: 4 }),
    ];
    const t = sumItems(items);
    expect(t.total_calories).toBe(300);
    expect(t.total_protein_g).toBeCloseTo(25, 1);
    expect(t.total_fat_g).toBeCloseTo(18, 1);
    expect(t.total_net_carbs_g).toBeCloseTo(7, 1);
  });
});

describe("sumEntries", () => {
  it("sums entry-level totals and counts meals", () => {
    const entries: MealEntry[] = [
      mockEntry({ total_calories: 400, total_protein_g: 30, total_net_carbs_g: 5 }),
      mockEntry({ total_calories: 300, total_protein_g: 20, total_net_carbs_g: 8 }),
    ];
    const t = sumEntries(entries);
    expect(t.meals_count).toBe(2);
    expect(t.total_calories).toBe(700);
    expect(t.total_protein_g).toBe(50);
    expect(t.total_net_carbs_g).toBe(13);
  });
});

describe("defaultTargets", () => {
  it("defaults to 1.2g/kg protein from baseline weight", () => {
    expect(defaultTargets(70).protein_g).toBe(84);
    expect(defaultTargets(60).protein_g).toBe(72);
  });
  it("falls back to 84g protein when no weight is set", () => {
    expect(defaultTargets().protein_g).toBe(84);
  });
  it("caps net carbs at 50g/day", () => {
    expect(defaultTargets(70).net_carbs_g_max).toBe(50);
  });
  it("scales calorie target by 30 kcal/kg", () => {
    expect(defaultTargets(70).calories_kcal).toBe(2100);
  });
});

describe("foodHint", () => {
  it("flags PERT-required for fatty foods first", () => {
    const f: FoodItem = { ...baseFood, pdac_high_fat_pert: true, net_carbs_g: 0 };
    expect(foodHint(f).tone).toBe("watch");
  });
  it("good for low net carbs", () => {
    const f: FoodItem = { ...baseFood, net_carbs_g: 3 };
    expect(foodHint(f).tone).toBe("good");
  });
  it("ok for moderate net carbs", () => {
    const f: FoodItem = { ...baseFood, net_carbs_g: 10 };
    expect(foodHint(f).tone).toBe("ok");
  });
  it("avoid for high net carbs", () => {
    const f: FoodItem = { ...baseFood, net_carbs_g: 30 };
    expect(foodHint(f).tone).toBe("avoid");
  });
});

describe("shouldPromptPert", () => {
  it("prompts when fat threshold exceeded and not yet taken", () => {
    expect(
      shouldPromptPert({ total_fat_g: PERT_FAT_THRESHOLD_G + 1, pert_taken: false }),
    ).toBe(true);
  });
  it("does not prompt when PERT already taken", () => {
    expect(
      shouldPromptPert({ total_fat_g: 25, pert_taken: true }),
    ).toBe(false);
  });
  it("does not prompt for low-fat meals", () => {
    expect(
      shouldPromptPert({ total_fat_g: 5, pert_taken: false }),
    ).toBe(false);
  });
});

describe("caloriesFromMacros", () => {
  it("uses 4/9/4 Atwater conversion", () => {
    expect(caloriesFromMacros(30, 20, 10)).toBe(30 * 4 + 20 * 9 + 10 * 4);
  });
});

function mockItem(p: Partial<MealItem> = {}): MealItem {
  return {
    meal_entry_id: 1,
    food_name: "x",
    serving_grams: 100,
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_total_g: 0,
    fiber_g: 0,
    net_carbs_g: 0,
    created_at: "",
    ...p,
  };
}

function mockEntry(p: Partial<MealEntry> = {}): MealEntry {
  return {
    date: "2026-04-25",
    meal_type: "lunch",
    logged_at: "2026-04-25T12:00:00Z",
    source: "manual",
    total_calories: 0,
    total_protein_g: 0,
    total_fat_g: 0,
    total_carbs_g: 0,
    total_fiber_g: 0,
    total_net_carbs_g: 0,
    entered_by: "hulin",
    created_at: "",
    updated_at: "",
    ...p,
  };
}
