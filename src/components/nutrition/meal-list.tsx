"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { Trash2, ChevronDown, BookmarkPlus, Repeat, Pencil } from "lucide-react";
import {
  listMealsForDate,
  listItemsForMeal,
  deleteMeal,
} from "~/lib/nutrition/queries";
import { relogMeal, saveMealAsTemplate } from "~/lib/nutrition/templates";
import { todayISO } from "~/lib/utils/date";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";
import type { MealType } from "~/types/nutrition";

const ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function MealList({ date }: { date: string }) {
  const locale = useLocale();
  const meals =
    useLiveQuery(async () => listMealsForDate(date), [date]) ?? [];

  if (meals.length === 0) {
    return (
      <Card className="px-5 py-8 text-center text-sm text-ink-500">
        {locale === "zh"
          ? "今天还没有记录。从上方添加这一餐。"
          : "No meals logged yet. Add one above."}
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {ORDER.map((mt) => {
        const slot = meals.filter((m) => m.meal_type === mt);
        if (slot.length === 0) return null;
        return (
          <div key={mt}>
            <div className="mono mb-1.5 px-1 text-[10px] uppercase tracking-wider text-ink-400">
              {mealLabel(mt, locale)}
            </div>
            <ul className="space-y-1.5">
              {slot.map((m) => (
                <li key={m.id}>
                  <MealCard mealId={m.id!} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MealCard({ mealId }: { mealId: number }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const items =
    useLiveQuery(async () => listItemsForMeal(mealId), [mealId]) ?? [];
  const meal = useLiveQuery(
    async () => {
      const { db } = await import("~/lib/db/dexie");
      return db.meal_entries.get(mealId);
    },
    [mealId],
  );
  if (!meal) return null;

  const time = new Date(meal.logged_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink-900">
              {meal.notes
                ? meal.notes
                : items[0]?.food_name ??
                  (locale === "zh" ? "记录的一餐" : "Logged meal")}
              {items.length > 1 && (
                <span className="ml-1 text-ink-500">
                  +{items.length - 1}
                </span>
              )}
            </span>
            <span className="mono text-[10px] text-ink-400">{time}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            {meal.total_protein_g}g P · {meal.total_fat_g}g F ·{" "}
            {meal.total_net_carbs_g}g net C · {meal.total_calories} kcal
          </div>
          {meal.pert_taken === false && meal.total_fat_g >= 15 && (
            <div className="mt-1 inline-block rounded-full bg-[var(--warn,#d97706)]/10 px-2 py-0.5 text-[10px] text-[var(--warn,#d97706)]">
              {locale === "zh" ? "未服胰酶" : "PERT not taken"}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-ink-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-ink-100/60 bg-paper-2/40 px-4 py-3">
          {meal.photo_data_url && (
            <img
              src={meal.photo_data_url}
              alt="Meal"
              className="max-h-48 w-full rounded-md object-contain"
            />
          )}
          <ul className="space-y-1">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-baseline justify-between gap-2 text-[12px]"
              >
                <span className="text-ink-700">
                  {locale === "zh" && it.food_name_zh
                    ? it.food_name_zh
                    : it.food_name}{" "}
                  <span className="text-ink-400">· {it.serving_grams}g</span>
                </span>
                <span className="mono text-ink-500">
                  {it.protein_g}P · {it.fat_g}F · {it.net_carbs_g}NC ·{" "}
                  {it.calories}kcal
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Link
              href={`/nutrition/${mealId}`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <Pencil className="h-3 w-3" />
              {locale === "zh" ? "编辑" : "Edit"}
            </Link>
            <button
              type="button"
              onClick={async () => {
                await relogMeal({
                  source_meal_id: mealId,
                  date: todayISO(),
                  entered_by: "hulin",
                });
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <Repeat className="h-3 w-3" />
              {locale === "zh" ? "再来一次" : "Log again"}
            </button>
            <button
              type="button"
              onClick={async () => {
                const name = prompt(
                  locale === "zh"
                    ? "给这一餐起个名字 (例如：常吃的早餐)"
                    : "Save this meal as… (e.g. My usual breakfast)",
                  meal.notes ?? "",
                );
                if (name && name.trim()) {
                  await saveMealAsTemplate({
                    meal_entry_id: mealId,
                    name: name.trim(),
                  });
                }
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <BookmarkPlus className="h-3 w-3" />
              {locale === "zh" ? "保存常吃" : "Save as template"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  confirm(
                    locale === "zh"
                      ? "删除这条记录？"
                      : "Delete this meal log?",
                  )
                ) {
                  await deleteMeal(mealId);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-ink-400 hover:bg-ink-100 hover:text-[var(--warn,#d97706)]"
            >
              <Trash2 className="h-3 w-3" />
              {locale === "zh" ? "删除" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function mealLabel(m: MealType, locale: string): string {
  if (locale !== "zh") {
    return { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" }[m];
  }
  return { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" }[m];
}
