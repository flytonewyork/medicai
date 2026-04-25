"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Trash2, Save, Clock, X, Pencil } from "lucide-react";
import { db } from "~/lib/db/dexie";
import {
  deleteMeal,
  deleteMealItem,
  listItemsForMeal,
  updateMeal,
  updateMealItemServing,
} from "~/lib/nutrition/queries";
import { sumItems } from "~/lib/nutrition/calculator";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, Textarea, TextInput } from "~/components/ui/field";
import { cn } from "~/lib/utils/cn";
import type { MealItem, MealType } from "~/types/nutrition";

// Edit screen for a single meal_entry. Patient can change:
//   - Approximate eating time (logged_at)
//   - Date (rare; the meal was eaten yesterday and logged today)
//   - Meal type (breakfast → snack, etc.)
//   - Notes
//   - Per-item serving size (recomputes that item's macros + the
//     parent meal totals)
//   - Per-item delete
//   - PERT taken / units
//   - Whole-meal delete
export default function EditMealPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ? Number(params.id) : NaN;
  const locale = useLocale();
  const meal = useLiveQuery(
    async () => (Number.isFinite(id) ? db.meal_entries.get(id) : undefined),
    [id],
  );
  const items =
    useLiveQuery(
      async () =>
        Number.isFinite(id) ? listItemsForMeal(id) : ([] as MealItem[]),
      [id],
    ) ?? [];

  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [type, setType] = useState<MealType>("snack");
  const [notes, setNotes] = useState<string>("");
  const [pertTaken, setPertTaken] = useState<boolean>(false);
  const [pertUnits, setPertUnits] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Hydrate the form from the live meal once it loads. Only the first
  // time — afterwards, edits override.
  useEffect(() => {
    if (!meal || dirty) return;
    const t = new Date(meal.logged_at);
    setTime(toHHMM(t));
    setDate(meal.date);
    setType(meal.meal_type);
    setNotes(meal.notes ?? "");
    setPertTaken(!!meal.pert_taken);
    setPertUnits(meal.pert_units ? String(meal.pert_units) : "");
  }, [meal, dirty]);

  if (!Number.isFinite(id)) {
    return (
      <div className="mx-auto max-w-xl p-6 text-sm text-ink-500">
        Invalid meal id.
      </div>
    );
  }
  if (meal === undefined) return null; // loading
  if (meal === null) {
    return (
      <div className="mx-auto max-w-xl p-6 text-sm text-ink-500">
        {locale === "zh" ? "记录不存在。" : "Meal not found."}
      </div>
    );
  }

  const totals = sumItems(items);
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  async function save() {
    if (!Number.isFinite(id) || !meal) return;
    setSaving(true);
    try {
      await updateMeal({
        meal_entry_id: id,
        date,
        meal_type: type,
        logged_at: assembleLoggedAt(date, time),
        notes: notes.trim() ? notes.trim() : null,
        pert_taken: pertTaken,
        pert_units: pertUnits.trim() ? Number(pertUnits) : null,
      });
      router.push("/nutrition");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {L("Back", "返回")}
      </button>

      <PageHeader
        eyebrow={L("EDIT MEAL", "编辑")}
        title={L("Edit meal", "修改这一餐")}
        subtitle={L(
          "Adjust the time eaten, the items, or notes.",
          "调整时间、分量或备注。",
        )}
      />

      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L("Date", "日期")}>
              <TextInput
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label={L("Time eaten", "进餐时间")}>
              <div className="flex items-center gap-2">
                <TextInput
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    setDirty(true);
                  }}
                />
                <Clock className="h-4 w-4 text-ink-400" />
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setType(m);
                  setDirty(true);
                }}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] capitalize",
                  type === m
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
                )}
              >
                {mealLabel(m, locale)}
              </button>
            ))}
          </div>

          <Field label={L("Notes", "备注")}>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
            />
          </Field>

          {totals.total_fat_g >= 15 && (
            <div className="rounded-md bg-[var(--warn,#d97706)]/10 px-3 py-2 text-[12px] text-[var(--warn,#d97706)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pertTaken}
                  onChange={(e) => {
                    setPertTaken(e.target.checked);
                    setDirty(true);
                  }}
                />
                {L("PERT taken with this meal", "已配胰酶")}
              </label>
              {pertTaken && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-700">
                  <span>{L("Units (lipase)", "脂肪酶单位")}</span>
                  <input
                    type="number"
                    placeholder="25000"
                    value={pertUnits}
                    onChange={(e) => {
                      setPertUnits(e.target.value);
                      setDirty(true);
                    }}
                    className="h-8 w-24 rounded-md border border-ink-200 bg-paper px-2 text-[12px]"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="eyebrow">{L("Items", "项目")}</h2>
          {items.length === 0 ? (
            <p className="rounded-md bg-paper-2/60 px-3 py-3 text-[12px] text-ink-500">
              {L(
                "All items removed. Saving will keep the meal record but with zero macros.",
                "所有项目已删除。保存后这一餐仍保留，但宏量为零。",
              )}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id}>
                  <ItemRow item={it} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-baseline justify-between border-t border-ink-100/60 pt-2 text-[12px]">
            <span className="text-ink-500">{L("Total", "合计")}</span>
            <span className="mono text-ink-700">
              {totals.total_protein_g}g P · {totals.total_fat_g}g F ·{" "}
              {totals.total_net_carbs_g}g NC ·{" "}
              {totals.total_calories} kcal
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => {
            if (
              confirm(
                L("Delete this meal log?", "删除这一餐记录？"),
              )
            ) {
              await deleteMeal(id);
              router.push("/nutrition");
            }
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-500 hover:bg-ink-100 hover:text-[var(--warn,#d97706)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {L("Delete meal", "删除这一餐")}
        </button>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4" />
          {L("Save changes", "保存修改")}
        </Button>
      </div>
    </div>
  );
}

function ItemRow({ item, locale }: { item: MealItem; locale: string }) {
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState<string>(String(item.serving_grams));
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);
  return (
    <div className="rounded-md border border-ink-100 bg-paper-2/40 p-3">
      <div className="flex items-baseline gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-900">
            {locale === "zh" && item.food_name_zh
              ? item.food_name_zh
              : item.food_name}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            {item.serving_grams}g · {item.protein_g}g P · {item.fat_g}g F ·{" "}
            {item.net_carbs_g}g NC · {item.calories} kcal
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
          aria-label="Edit item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              confirm(L("Remove this item?", "删除这一项？"))
            ) {
              await deleteMealItem(item.id!);
            }
          }}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-[var(--warn,#d97706)]"
          aria-label="Delete item"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-wide text-ink-400">
            g
          </span>
          <input
            type="number"
            min={0}
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="h-8 w-24 rounded-md border border-ink-200 bg-paper px-2 text-xs"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const n = Number(grams);
              if (!Number.isFinite(n) || n < 0) return;
              await updateMealItemServing({
                meal_item_id: item.id!,
                serving_grams: n,
              });
              setEditing(false);
            }}
          >
            {L("Apply", "应用")}
          </Button>
        </div>
      )}
    </div>
  );
}

function mealLabel(m: MealType, locale: string): string {
  if (locale !== "zh") return m;
  return { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" }[m];
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function assembleLoggedAt(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map((s) => Number(s));
  const [hh, mm] = (hhmm || "00:00").split(":").map((s) => Number(s));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}
