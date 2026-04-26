import type {
  FoodItem,
  MacrosPer100g,
  MealEntry,
  MealItem,
  DailyNutritionTarget,
  FoodPickerHint,
} from "~/types/nutrition";

// Net carbs convention: total carbohydrates minus dietary fibre minus
// sugar alcohols. Clamped to 0 — some manufacturers list fibre values
// that round above the carb total. We don't want negative net carbs in
// search / sort.
export function netCarbs(
  carbs_total_g: number,
  fiber_g: number,
  sugar_alcohols_g = 0,
): number {
  const v = carbs_total_g - fiber_g - sugar_alcohols_g;
  return Math.max(0, round1(v));
}

export function recalcNetCarbs<T extends MacrosPer100g>(m: T): number {
  return netCarbs(m.carbs_total_g, m.fiber_g, m.sugar_alcohols_g ?? 0);
}

// Scale a "per 100 g" food to an arbitrary serving weight.
export function scaleByGrams(
  food: Pick<
    FoodItem,
    | "calories"
    | "protein_g"
    | "fat_g"
    | "carbs_total_g"
    | "fiber_g"
    | "sugar_alcohols_g"
    | "net_carbs_g"
  >,
  grams: number,
): {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_total_g: number;
  fiber_g: number;
  net_carbs_g: number;
} {
  if (!Number.isFinite(grams) || grams <= 0) {
    return {
      calories: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_total_g: 0,
      fiber_g: 0,
      net_carbs_g: 0,
    };
  }
  const f = grams / 100;
  return {
    calories: round0(food.calories * f),
    protein_g: round1(food.protein_g * f),
    fat_g: round1(food.fat_g * f),
    carbs_total_g: round1(food.carbs_total_g * f),
    fiber_g: round1(food.fiber_g * f),
    net_carbs_g: round1(food.net_carbs_g * f),
  };
}

// Sum a list of meal items into the totals stored on a MealEntry.
export function sumItems(items: ReadonlyArray<MealItem>): {
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  total_fiber_g: number;
  total_net_carbs_g: number;
} {
  let cal = 0,
    p = 0,
    f = 0,
    c = 0,
    fb = 0,
    nc = 0;
  for (const it of items) {
    cal += it.calories;
    p += it.protein_g;
    f += it.fat_g;
    c += it.carbs_total_g;
    fb += it.fiber_g;
    nc += it.net_carbs_g;
  }
  return {
    total_calories: round0(cal),
    total_protein_g: round1(p),
    total_fat_g: round1(f),
    total_carbs_g: round1(c),
    total_fiber_g: round1(fb),
    total_net_carbs_g: round1(nc),
  };
}

// Sum entry-level totals across a day. Cheaper than walking items —
// the dashboard uses this on the meal_entries snapshot.
export function sumEntries(entries: ReadonlyArray<MealEntry>): {
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  total_fiber_g: number;
  total_net_carbs_g: number;
  meals_count: number;
} {
  let cal = 0,
    p = 0,
    f = 0,
    c = 0,
    fb = 0,
    nc = 0;
  for (const e of entries) {
    cal += e.total_calories;
    p += e.total_protein_g;
    f += e.total_fat_g;
    c += e.total_carbs_g;
    fb += e.total_fiber_g;
    nc += e.total_net_carbs_g;
  }
  return {
    total_calories: round0(cal),
    total_protein_g: round1(p),
    total_fat_g: round1(f),
    total_carbs_g: round1(c),
    total_fiber_g: round1(fb),
    total_net_carbs_g: round1(nc),
    meals_count: entries.length,
  };
}

// Default targets. Protein at 1.2 g/kg/day per the nutrition agent's
// remit. Net carb cap defaults to 50 g/day for a relaxed-keto / low-
// carb pattern that's compatible with the patient values document
// (PDAC patients can tolerate ketogenic patterns; strict <20 g is
// rarely sustainable during chemo).
//
// `mode` lets the caller request the JPCC-style energy-dense pattern
// when cachexia is the bigger threat than glycaemia — calories per kg
// rise from 30 → 35 and the net-carb cap effectively lifts (set high
// enough that the dashboard stops scoring against it). See
// `lib/nutrition/policy.ts` for the selector that picks a mode from
// the patient's recent trajectory.
export function defaultTargets(
  weight_kg?: number,
  mode: "low_carb" | "energy_dense" | "transitional" = "low_carb",
): DailyNutritionTarget {
  const proteinPerKg = mode === "energy_dense" ? 1.5 : 1.2;
  const proteinTarget = weight_kg
    ? Math.round(weight_kg * proteinPerKg)
    : Math.round(70 * proteinPerKg);
  const calorieMultiplier = mode === "energy_dense" ? 35 : 30;
  const calorieTarget = weight_kg
    ? Math.round(weight_kg * calorieMultiplier)
    : Math.round(70 * calorieMultiplier);
  // Energy-dense mode lifts the cap effectively to "uncapped" by
  // setting it high enough that nothing realistic trips it. We keep
  // the field populated so existing UI components don't have to
  // handle null.
  const netCarbCap = mode === "energy_dense" ? 250 : 50;
  return {
    calories_kcal: calorieTarget,
    protein_g: proteinTarget,
    net_carbs_g_max: netCarbCap,
    fluids_ml: 2000,
  };
}

// Picker hint: one-glance traffic light for a candidate food. Order of
// checks matters — high-fat-without-PERT trumps net-carb appraisal.
export function foodHint(food: FoodItem): FoodPickerHint {
  if (food.pdac_high_fat_pert) {
    return {
      tone: "watch",
      label: { en: "Fatty — take PERT", zh: "高脂肪 — 配胰酶" },
    };
  }
  if (food.net_carbs_g <= 5) {
    return {
      tone: "good",
      label: { en: "Low carb", zh: "低碳水" },
    };
  }
  if (food.net_carbs_g <= 15) {
    return {
      tone: "ok",
      label: { en: "Moderate", zh: "中等" },
    };
  }
  return {
    tone: "avoid",
    label: { en: "High carb", zh: "高碳水" },
  };
}

// Estimate of a "PERT prompt threshold". When a single meal exceeds
// this fat content, the dashboard nudges the patient about Creon.
export const PERT_FAT_THRESHOLD_G = 15;

export function shouldPromptPert(meal: {
  total_fat_g: number;
  pert_taken?: boolean;
}): boolean {
  if (meal.pert_taken) return false;
  return meal.total_fat_g >= PERT_FAT_THRESHOLD_G;
}

// Energy from macros. Useful for sanity-checking AI-parsed meals
// (a 200 kcal estimate with 30 g protein + 20 g fat is incoherent).
export function caloriesFromMacros(
  protein_g: number,
  fat_g: number,
  net_carbs_g: number,
): number {
  return round0(protein_g * 4 + fat_g * 9 + net_carbs_g * 4);
}

function round0(n: number): number {
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
