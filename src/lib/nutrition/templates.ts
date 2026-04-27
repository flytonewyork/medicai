import { db, now } from "~/lib/db/dexie";
import { sumItems } from "./calculator";
import { createMeal } from "./queries";
import type {
  MealEntry,
  MealItem,
  MealTemplate,
  MealTemplateItem,
  MealType,
} from "~/types/nutrition";
import type { EnteredBy } from "~/types/clinical";

// Snapshot a meal entry + its items into a reusable template. The
// template stores macros that have already been scaled to the
// serving — re-logging the template applies them verbatim, so the
// totals are stable even if the source food row is later edited.
export async function saveMealAsTemplate(args: {
  meal_entry_id: number;
  name: string;
  name_zh?: string;
  notes?: string;
}): Promise<number> {
  const entry = await db.meal_entries.get(args.meal_entry_id);
  if (!entry) throw new Error("Meal not found");
  const items = await db.meal_items
    .where("meal_entry_id")
    .equals(args.meal_entry_id)
    .toArray();

  const t = now();
  return (await db.meal_templates.add({
    name: args.name,
    name_zh: args.name_zh,
    meal_type: entry.meal_type,
    items: items.map(toTemplateItem),
    notes: args.notes ?? entry.notes,
    use_count: 0,
    created_at: t,
    updated_at: t,
  })) as number;
}

function toTemplateItem(it: MealItem): MealTemplateItem {
  return {
    food_id: it.food_id,
    food_name: it.food_name,
    food_name_zh: it.food_name_zh,
    serving_grams: it.serving_grams,
    calories: it.calories,
    protein_g: it.protein_g,
    fat_g: it.fat_g,
    carbs_total_g: it.carbs_total_g,
    fiber_g: it.fiber_g,
    net_carbs_g: it.net_carbs_g,
  };
}

// Templates surfaced in the picker. "Recent" first (last_used_at desc),
// then "favourites" (use_count desc), capped to `limit`. Exposed as a
// flat list so the UI can render either ordering with a sort flip.
export async function listTemplates(
  opts: { limit?: number; orderBy?: "recent" | "favourites" } = {},
): Promise<MealTemplate[]> {
  const all = await db.meal_templates.toArray();
  const order = opts.orderBy ?? "recent";
  all.sort((a, b) => {
    if (order === "recent") {
      const av = a.last_used_at ?? a.updated_at;
      const bv = b.last_used_at ?? b.updated_at;
      return bv.localeCompare(av);
    }
    if (a.use_count !== b.use_count) return b.use_count - a.use_count;
    return (b.last_used_at ?? "").localeCompare(a.last_used_at ?? "");
  });
  return opts.limit ? all.slice(0, opts.limit) : all;
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.meal_templates.delete(id);
}

// Re-log a template as a fresh meal_entry on `date` / at the current
// time. Bumps the template's use_count + last_used_at so the UI's
// "favourites" sort works.
export async function logTemplate(args: {
  template_id: number;
  date: string;
  meal_type?: MealType;
  entered_by: EnteredBy;
  entered_by_user_id?: string;
}): Promise<number> {
  const tpl = await db.meal_templates.get(args.template_id);
  if (!tpl) throw new Error("Template not found");

  const id = await createMeal({
    date: args.date,
    meal_type: args.meal_type ?? tpl.meal_type ?? "snack",
    source: "manual",
    entered_by: args.entered_by,
    entered_by_user_id: args.entered_by_user_id,
    notes: tpl.notes,
    items: tpl.items.map((it) => ({
      kind: "inline" as const,
      name: it.food_name,
      name_zh: it.food_name_zh,
      serving_grams: it.serving_grams,
      // Convert serving-scaled macros back to per-100 g shape so
      // createMeal's inline branch (which multiplies by g/100) ends up
      // with the same per-meal totals.
      macros: macrosPer100g(it),
    })),
  });

  await db.meal_templates.update(args.template_id, {
    use_count: (tpl.use_count ?? 0) + 1,
    last_used_at: now(),
    updated_at: now(),
  });
  return id;
}

// Re-log a previous meal under today's date. Useful for "had the same
// thing as yesterday's lunch" patterns. Doesn't touch the template
// table — this is the inline copy path.
export async function relogMeal(args: {
  source_meal_id: number;
  date: string;
  meal_type?: MealType;
  entered_by: EnteredBy;
  entered_by_user_id?: string;
}): Promise<number> {
  const src = await db.meal_entries.get(args.source_meal_id);
  if (!src) throw new Error("Meal not found");
  const items = await db.meal_items
    .where("meal_entry_id")
    .equals(args.source_meal_id)
    .toArray();

  return createMeal({
    date: args.date,
    meal_type: args.meal_type ?? src.meal_type,
    source: "manual",
    entered_by: args.entered_by,
    entered_by_user_id: args.entered_by_user_id,
    notes: src.notes,
    items: items.map((it) => ({
      kind: "inline" as const,
      name: it.food_name,
      name_zh: it.food_name_zh,
      serving_grams: it.serving_grams,
      macros: macrosPer100g(it),
    })),
  });
}

function macrosPer100g(it: MealTemplateItem | MealItem) {
  const factor = 100 / Math.max(1, it.serving_grams);
  return {
    calories: it.calories * factor,
    protein_g: it.protein_g * factor,
    fat_g: it.fat_g * factor,
    carbs_total_g: it.carbs_total_g * factor,
    fiber_g: it.fiber_g * factor,
  };
}

// Convenience: surface a meal_entry's totals from its items, used by
// the template-detail view and the "log again" preview.
export async function summariseMeal(
  meal_entry_id: number,
): Promise<{ entry: MealEntry; items: MealItem[]; totals: ReturnType<typeof sumItems> } | null> {
  const entry = await db.meal_entries.get(meal_entry_id);
  if (!entry) return null;
  const items = await db.meal_items
    .where("meal_entry_id")
    .equals(meal_entry_id)
    .toArray();
  return { entry, items, totals: sumItems(items) };
}
