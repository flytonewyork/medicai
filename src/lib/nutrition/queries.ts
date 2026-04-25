import { db, now } from "~/lib/db/dexie";
import { SEED_FOODS } from "./seed-foods";
import { recalcNetCarbs, scaleByGrams, sumItems } from "./calculator";
import type {
  FoodItem,
  MealEntry,
  MealItem,
  MealType,
} from "~/types/nutrition";

// One-shot seeder. Idempotent: if the foods table already has any
// rows we treat the catalogue as user-managed and don't re-seed. Run
// from `ensureSeeded()` at app start.
export async function ensureFoodsSeeded(): Promise<void> {
  const count = await db.foods.count();
  if (count > 0) return;
  const t = now();
  for (const seed of SEED_FOODS) {
    const net = recalcNetCarbs(seed);
    await db.foods.add({
      ...seed,
      net_carbs_g: net,
      created_at: t,
      updated_at: t,
    });
  }
}

export async function searchFoods(
  query: string,
  opts: { limit?: number; ketoOnly?: boolean; easyDigestOnly?: boolean } = {},
): Promise<FoodItem[]> {
  const limit = opts.limit ?? 25;
  const q = query.trim().toLowerCase();
  // Empty query → return a curated "popular for PDAC" slice (keto-friendly,
  // easy-digest, alphabetically). Keeps the picker non-empty before the
  // user types anything.
  if (!q) {
    const all = await db.foods.orderBy("name").limit(60).toArray();
    return all
      .filter((f) => (opts.ketoOnly ? f.keto_friendly : true))
      .filter((f) => (opts.easyDigestOnly ? !!f.pdac_easy_digest : true))
      .slice(0, limit);
  }
  // Substring match across name + name_zh + tags + brand. Cheap (catalogue
  // fits in memory) — switch to Dexie's compound index if it grows >5k rows.
  const all = await db.foods.toArray();
  const matches = all.filter((f) => {
    if (opts.ketoOnly && !f.keto_friendly) return false;
    if (opts.easyDigestOnly && !f.pdac_easy_digest) return false;
    const haystacks = [
      f.name,
      f.name_zh ?? "",
      f.brand ?? "",
      f.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystacks.includes(q);
  });
  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, limit);
}

export async function getFood(id: number): Promise<FoodItem | undefined> {
  return db.foods.get(id);
}

export async function upsertFood(
  food: Omit<FoodItem, "id" | "net_carbs_g" | "created_at" | "updated_at"> & {
    id?: number;
  },
): Promise<number> {
  const t = now();
  const net = recalcNetCarbs(food);
  if (food.id) {
    await db.foods.update(food.id, { ...food, net_carbs_g: net, updated_at: t });
    return food.id;
  }
  return (await db.foods.add({
    ...food,
    net_carbs_g: net,
    created_at: t,
    updated_at: t,
  })) as number;
}

export async function deleteFood(id: number): Promise<void> {
  await db.foods.delete(id);
}

export async function listMealsForDate(date: string): Promise<MealEntry[]> {
  const rows = await db.meal_entries
    .where("date")
    .equals(date)
    .toArray();
  // Stable sort by meal type then logged_at.
  const order: Record<MealType, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
    snack: 3,
  };
  rows.sort((a, b) => {
    const o = (order[a.meal_type] ?? 9) - (order[b.meal_type] ?? 9);
    if (o !== 0) return o;
    return a.logged_at.localeCompare(b.logged_at);
  });
  return rows;
}

export async function listItemsForMeal(
  meal_entry_id: number,
): Promise<MealItem[]> {
  return db.meal_items
    .where("meal_entry_id")
    .equals(meal_entry_id)
    .toArray();
}

export async function listMealsBetween(
  startDate: string,
  endDate: string,
): Promise<MealEntry[]> {
  return db.meal_entries
    .where("date")
    .between(startDate, endDate, true, true)
    .toArray();
}

// Build a fully-priced meal item from a food + grams. The macros are
// snapshotted at log time so subsequent food edits don't retroactively
// change history.
export function buildMealItem(
  food: FoodItem,
  serving_grams: number,
  meal_entry_id: number,
  notes?: string,
): Omit<MealItem, "id"> {
  const macros = scaleByGrams(food, serving_grams);
  return {
    meal_entry_id,
    food_id: food.id,
    food_name: food.name,
    food_name_zh: food.name_zh,
    serving_grams,
    ...macros,
    notes,
    created_at: now(),
  };
}

export interface CreateMealInput {
  date: string;
  meal_type: MealType;
  logged_at?: string;
  notes?: string;
  photo_data_url?: string;
  source: MealEntry["source"];
  confidence?: MealEntry["confidence"];
  pert_taken?: boolean;
  pert_units?: number;
  entered_by: MealEntry["entered_by"];
  entered_by_user_id?: string;
  items: Array<
    | { kind: "food"; food: FoodItem; serving_grams: number; notes?: string }
    | {
        kind: "inline";
        name: string;
        name_zh?: string;
        serving_grams: number;
        macros: {
          calories: number;
          protein_g: number;
          fat_g: number;
          carbs_total_g: number;
          fiber_g: number;
        };
        notes?: string;
      }
  >;
}

export async function createMeal(input: CreateMealInput): Promise<number> {
  const t = now();
  const itemsForSum = input.items.map((it) => {
    if (it.kind === "food") {
      const m = scaleByGrams(it.food, it.serving_grams);
      return {
        meal_entry_id: 0,
        food_id: it.food.id,
        food_name: it.food.name,
        food_name_zh: it.food.name_zh,
        serving_grams: it.serving_grams,
        ...m,
        notes: it.notes,
        created_at: t,
      } satisfies MealItem;
    }
    const f = it.serving_grams / 100;
    const carbs_total_g = it.macros.carbs_total_g;
    const fiber_g = it.macros.fiber_g;
    const net_carbs_g = Math.max(0, round1(carbs_total_g - fiber_g));
    return {
      meal_entry_id: 0,
      food_name: it.name,
      food_name_zh: it.name_zh,
      serving_grams: it.serving_grams,
      calories: round0(it.macros.calories * f),
      protein_g: round1(it.macros.protein_g * f),
      fat_g: round1(it.macros.fat_g * f),
      carbs_total_g: round1(carbs_total_g * f),
      fiber_g: round1(fiber_g * f),
      net_carbs_g: round1(net_carbs_g * f),
      notes: it.notes,
      created_at: t,
    } satisfies MealItem;
  });
  const totals = sumItems(itemsForSum);

  const entryId = (await db.meal_entries.add({
    date: input.date,
    meal_type: input.meal_type,
    logged_at: input.logged_at ?? t,
    notes: input.notes,
    photo_data_url: input.photo_data_url,
    source: input.source,
    confidence: input.confidence,
    pert_taken: input.pert_taken,
    pert_units: input.pert_units,
    entered_by: input.entered_by,
    entered_by_user_id: input.entered_by_user_id,
    ...totals,
    created_at: t,
    updated_at: t,
  })) as number;
  for (const it of itemsForSum) {
    await db.meal_items.add({ ...it, meal_entry_id: entryId });
  }
  return entryId;
}

export async function deleteMeal(meal_entry_id: number): Promise<void> {
  await db.meal_items
    .where("meal_entry_id")
    .equals(meal_entry_id)
    .delete();
  await db.meal_entries.delete(meal_entry_id);
}

export async function recomputeMealTotals(meal_entry_id: number): Promise<void> {
  const items = await listItemsForMeal(meal_entry_id);
  const totals = sumItems(items);
  await db.meal_entries.update(meal_entry_id, {
    ...totals,
    updated_at: now(),
  });
}

function round0(n: number): number {
  return Math.round(n);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
