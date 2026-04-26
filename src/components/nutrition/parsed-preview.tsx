"use client";

import { useEffect, useState } from "react";
import { Check, X, Pencil, Trash2 } from "lucide-react";
import { searchFoods } from "~/lib/nutrition/queries";
import { caloriesFromMacros } from "~/lib/nutrition/calculator";
import { evaluatePert } from "~/lib/nutrition/pert-engine";
import type {
  ParsedMealResult,
} from "~/lib/nutrition/parser-schema";
import type { FoodItem, MealType } from "~/types/nutrition";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";

export interface PreviewItem {
  name: string;
  name_zh?: string;
  serving_grams: number;
  serving_label?: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_total_g: number;
  fiber_g: number;
  notes?: string;
  food_id?: number;          // resolved if a database match was confirmed
  food_match?: FoodItem;     // optional UI-side hint
}

// Editable preview of an AI-parsed meal. Each row can be edited,
// removed, or matched to a known food. The patient's job is to
// nod (or correct) and confirm.
export function ParsedPreview({
  parsed,
  source,
  photoDataUrl,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedMealResult;
  source: "photo" | "text";
  photoDataUrl?: string;
  onConfirm: (data: {
    items: PreviewItem[];
    meal_type: MealType;
    description: string;
    pert_taken: boolean;
    confidence: ParsedMealResult["confidence"];
    photo_data_url?: string;
  }) => void;
  onCancel: () => void;
}) {
  const locale = useLocale();
  // Serving sizes snap to 100 g on intake — clean baseline for the
  // per-100 g reference frame. Macros scale with the snap so the
  // absolute grams and macros stay internally consistent. The patient
  // then refines in 50/100 g increments; every grams change re-scales
  // the macro row.
  const [items, setItems] = useState<PreviewItem[]>(() =>
    parsed.items.map((it) =>
      scalePreviewItemToGrams(
        {
          name: it.name,
          name_zh: it.name_zh ?? undefined,
          serving_grams: it.serving_grams,
          serving_label: it.serving_label ?? undefined,
          calories: it.calories,
          protein_g: it.protein_g,
          fat_g: it.fat_g,
          carbs_total_g: it.carbs_total_g,
          fiber_g: it.fiber_g,
          notes: it.notes ?? undefined,
        },
        snapTo100(it.serving_grams),
      ),
    ),
  );
  const [mealType, setMealType] = useState<MealType>(
    parsed.meal_type ?? autoMealType(),
  );
  const [pertTaken, setPertTaken] = useState(false);

  // Best-effort auto-match each parsed item against the foods table.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      items.map(async (it, idx) => {
        if (it.food_id) return null;
        const candidates = await searchFoods(it.name, { limit: 3 });
        const top = candidates[0];
        if (!top) return null;
        const aLower = it.name.toLowerCase();
        const bLower = top.name.toLowerCase();
        if (aLower === bLower || bLower.startsWith(aLower) || aLower.startsWith(bLower)) {
          return { idx, food: top };
        }
        return null;
      }),
    ).then((matches) => {
      if (cancelled) return;
      setItems((cur) => {
        const next = [...cur];
        for (const m of matches) {
          if (!m) continue;
          if (!next[m.idx]) continue;
          next[m.idx] = { ...next[m.idx], food_id: m.food.id, food_match: m.food };
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // We only want to auto-match once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalP = round1(items.reduce((s, x) => s + x.protein_g, 0));
  const totalF = round1(items.reduce((s, x) => s + x.fat_g, 0));
  const totalC = round1(items.reduce((s, x) => s + x.carbs_total_g, 0));
  const totalFib = round1(items.reduce((s, x) => s + x.fiber_g, 0));
  const totalCal = items.reduce((s, x) => s + x.calories, 0);
  const totalNet = Math.max(0, round1(totalC - totalFib));
  const macroCal = caloriesFromMacros(totalP, totalF, totalNet);
  const calorieDrift =
    totalCal > 0 ? Math.abs(totalCal - macroCal) / Math.max(totalCal, 1) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-100/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">
            {locale === "zh" ? "AI 识别" : "AI estimate"} ·{" "}
            {parsed.confidence}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 text-sm text-ink-900">{parsed.description}</div>
      </div>

      {photoDataUrl && (
        <div className="bg-paper-2/40">
          <img
            src={photoDataUrl}
            alt="Meal"
            className="mx-auto max-h-64 w-full object-contain"
          />
        </div>
      )}

      <div className="space-y-2 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMealType(m)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] capitalize",
                mealType === m
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
              )}
            >
              {mealLabel(m, locale)}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2 px-4 py-3">
        {items.map((it, idx) => (
          <li
            key={idx}
            className="rounded-md border border-ink-100 bg-paper-2/40 p-3"
          >
            <ItemRow
              value={it}
              onChange={(v) =>
                setItems((cur) => cur.map((x, i) => (i === idx ? v : x)))
              }
              onRemove={() =>
                setItems((cur) => cur.filter((_, i) => i !== idx))
              }
            />
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-md bg-paper-2/40 px-3 py-4 text-center text-xs text-ink-500">
            {locale === "zh" ? "没有项目，已取消" : "No items left"}
          </li>
        )}
      </ul>

      <div className="space-y-3 border-t border-ink-100/60 bg-paper-2/40 px-4 py-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Total label={locale === "zh" ? "蛋白" : "Protein"} value={`${totalP}g`} />
          <Total label={locale === "zh" ? "脂肪" : "Fat"} value={`${totalF}g`} />
          <Total label={locale === "zh" ? "净碳" : "Net C"} value={`${totalNet}g`} />
          <Total label="kcal" value={`${totalCal}`} />
        </div>
        {calorieDrift > 0.25 && (
          <div className="rounded-md bg-paper px-3 py-2 text-[11px] text-ink-500">
            {locale === "zh"
              ? `提示：宏量推算热量约 ${macroCal} kcal，与 AI 估值差距较大，请检查。`
              : `Note: macros imply ~${macroCal} kcal, AI said ${totalCal}. Worth a sanity check.`}
          </div>
        )}
        {(() => {
          // JPCC PERT rule (engine, not the AI's free-text suggestion).
          // Engine returns required + recommendation + reason. We only
          // surface the prompt when PERT is required.
          const pert = evaluatePert({
            items: items.map((it) => ({
              food_name: it.name,
              protein_g: it.protein_g,
              fat_g: it.fat_g,
            })),
            meal_type: mealType,
          });
          if (!pert.required) return null;
          return (
            <div className="rounded-md bg-[var(--warn,#d97706)]/10 px-3 py-2 text-[12px] text-[var(--warn,#d97706)]">
              {pert.reason[locale]}
              <label className="ml-2 inline-flex items-center gap-1.5 text-[11px]">
                <input
                  type="checkbox"
                  checked={pertTaken}
                  onChange={(e) => setPertTaken(e.target.checked)}
                />
                {locale === "zh" ? "已服胰酶" : "PERT taken"}
              </label>
            </div>
          );
        })()}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {locale === "zh" ? "取消" : "Cancel"}
          </Button>
          <Button
            disabled={items.length === 0}
            onClick={() =>
              onConfirm({
                items,
                meal_type: mealType,
                description: parsed.description,
                pert_taken: pertTaken,
                confidence: parsed.confidence,
                photo_data_url: photoDataUrl,
              })
            }
          >
            <Check className="h-4 w-4" />
            {locale === "zh" ? "保存这餐" : "Save meal"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Serving-size presets, multiples of 100g. Stepper buttons add +/- 50g
// or +/- 100g for fine adjustment. Any change to grams scales all macros
// by the new/old ratio so the patient only has to correct one number.
const SERVING_PRESETS_G = [100, 200, 300] as const;
const GRAM_STEPS_G = [-100, -50, 50, 100] as const;

function ItemRow({
  value,
  onChange,
  onRemove,
}: {
  value: PreviewItem;
  onChange: (v: PreviewItem) => void;
  onRemove: () => void;
}) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);

  const setGrams = (raw: number) => {
    const next = Math.max(0, Math.round(raw));
    if (next === value.serving_grams) return;
    onChange(scalePreviewItemToGrams(value, next));
  };

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-900">
            {locale === "zh" && value.name_zh ? value.name_zh : value.name}
            {value.serving_label && (
              <span className="ml-1 text-[11px] font-normal text-ink-500">
                · {value.serving_label}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            {value.serving_grams}g · {value.protein_g}g P ·{" "}
            {value.fat_g}g F · {Math.max(0, round1(value.carbs_total_g - value.fiber_g))}g
            net C · {value.calories} kcal
          </div>
          {value.notes && (
            <div className="mt-0.5 text-[11px] italic text-ink-400">
              {value.notes}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 space-y-2 rounded-md bg-paper p-2">
          <div className="flex items-center gap-1">
            <span className="mono w-4 shrink-0 text-[10px] uppercase tracking-wide text-ink-400">
              g
            </span>
            {GRAM_STEPS_G.slice(0, 2).map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setGrams(value.serving_grams + delta)}
                disabled={value.serving_grams + delta < 0}
                className="rounded-md border border-ink-200 px-1.5 py-1 text-[11px] text-ink-700 hover:border-ink-300 disabled:opacity-40"
              >
                {delta}
              </button>
            ))}
            <input
              type="number"
              min={0}
              step={50}
              value={value.serving_grams}
              onChange={(e) => setGrams(Number(e.target.value) || 0)}
              className="h-8 w-16 rounded-md border border-ink-200 bg-paper px-1.5 text-center text-xs text-ink-900 focus:border-ink-900 focus:outline-none"
            />
            {GRAM_STEPS_G.slice(2).map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setGrams(value.serving_grams + delta)}
                className="rounded-md border border-ink-200 px-1.5 py-1 text-[11px] text-ink-700 hover:border-ink-300"
              >
                +{delta}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {SERVING_PRESETS_G.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrams(g)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px]",
                  value.serving_grams === g
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
                )}
              >
                {g}g
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Cell label="P" value={value.protein_g}
              onChange={(v) => onChange({ ...value, protein_g: v })} />
            <Cell label="F" value={value.fat_g}
              onChange={(v) => onChange({ ...value, fat_g: v })} />
            <Cell label="C" value={value.carbs_total_g}
              onChange={(v) => onChange({ ...value, carbs_total_g: v })} />
            <Cell label="Fib" value={value.fiber_g}
              onChange={(v) => onChange({ ...value, fiber_g: v })} />
            <Cell label="kcal" value={value.calories} step={5}
              onChange={(v) => onChange({ ...value, calories: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// Re-scale every macro on a preview item to a new serving weight. Used
// when the patient corrects grams — the AI's per-gram density is
// trusted, the absolute weight is what they're refining.
export function scalePreviewItemToGrams(
  item: PreviewItem,
  next_grams: number,
): PreviewItem {
  const next = Math.max(0, Math.round(next_grams));
  if (next === item.serving_grams) return item;
  if (next === 0) {
    return {
      ...item,
      serving_grams: 0,
      protein_g: 0,
      fat_g: 0,
      carbs_total_g: 0,
      fiber_g: 0,
      calories: 0,
    };
  }
  if (item.serving_grams <= 0) {
    return { ...item, serving_grams: next };
  }
  const f = next / item.serving_grams;
  return {
    ...item,
    serving_grams: next,
    protein_g: round1(item.protein_g * f),
    fat_g: round1(item.fat_g * f),
    carbs_total_g: round1(item.carbs_total_g * f),
    fiber_g: round1(item.fiber_g * f),
    calories: Math.round(item.calories * f),
  };
}

function Cell({
  label,
  value,
  step = 0.5,
  min,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mono block text-[10px] uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-0.5 h-8 w-full rounded-md border border-ink-200 bg-paper px-1.5 text-xs text-ink-900 focus:border-ink-900 focus:outline-none"
      />
    </label>
  );
}

// Snap a serving to the nearest 100 g, with a 100 g floor. Used at
// initial load (parser estimate → quantised) and on every grams edit
// in the preview.
function snapTo100(g: number): number {
  if (!Number.isFinite(g) || g <= 0) return 100;
  return Math.max(100, Math.round(g / 100) * 100);
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold text-ink-900">{value}</div>
      <div className="mono mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
    </div>
  );
}

function autoMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

function mealLabel(m: MealType, locale: string): string {
  if (locale !== "zh") return m;
  return { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" }[m];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
