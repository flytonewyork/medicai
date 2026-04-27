"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Sparkles, Clock, Loader2 } from "lucide-react";
import { todayISO } from "~/lib/utils/date";
import { useLocale } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/field";
import { PageHeader } from "~/components/ui/page-header";
import { MealIngest } from "~/components/nutrition/meal-ingest";
import {
  ParsedPreview,
  type PreviewItem,
} from "~/components/nutrition/parsed-preview";
import { FoodPicker } from "~/components/nutrition/food-picker";
import { TemplatesPicker } from "~/components/nutrition/templates-picker";
import { createMeal } from "~/lib/nutrition/queries";
import { sumItems } from "~/lib/nutrition/calculator";
import { parsedItemToInline } from "~/lib/nutrition/parser-to-meal";
import type {
  ParsedMealResult,
} from "~/lib/nutrition/parser-schema";
import type { FoodItem, MealType } from "~/types/nutrition";

interface PendingItem {
  food: FoodItem;
  serving_grams: number;
}

export default function LogMealPage() {
  const router = useRouter();
  const locale = useLocale();
  const enteredBy = useUIStore((s) => s.enteredBy);
  const [parsed, setParsed] = useState<ParsedMealResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [parsedSource, setParsedSource] = useState<"photo" | "text">("text");
  const [manualMeal, setManualMeal] = useState<MealType>(autoMealType());
  const [manualItems, setManualItems] = useState<PendingItem[]>([]);
  const [manualNotes, setManualNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Photo path is auto-save: as soon as the vision parse comes back we
  // write meal_entries + meal_items + totals and route to the detail
  // screen for review. `autoSaving` shows a transient overlay during
  // that round-trip so the patient knows the photo landed.
  const [autoSaving, setAutoSaving] = useState(false);
  // Approximate time the meal was eaten. Defaults to "now" so the
  // common case (logging right after eating) stays one tap; the user
  // can edit it for after-the-fact logging (e.g. logging breakfast
  // at 11 am after eating it at 7). Stored as a `HH:MM` string
  // so the <input type="time"> binding is straightforward; we
  // assemble the full ISO datetime at save time using the date for
  // the meal (today by default).
  const [mealTime, setMealTime] = useState<string>(currentHHMM());

  // Whenever the chosen meal-type changes through the auto-detector
  // (e.g. user opens this page in the morning vs. evening) we keep
  // mealTime in sync with current time. Manual edits are preserved.
  function handleMealTypeChange(t: MealType) {
    setManualMeal(t);
  }

  // Photo path: skip the preview confirm step and write straight to
  // the nutrition tables. The patient lands on /nutrition/[id] where
  // every field (per-item grams, macros, meal type, time, PERT) is
  // editable, so corrections still happen — just inverted (edit-
  // after rather than confirm-before). Honours the "single channel
  // in" principle: photo → state, no intermediate forms.
  async function autoSaveFromPhoto(
    result: ParsedMealResult,
    photoDataUrl: string | undefined,
  ) {
    setAutoSaving(true);
    try {
      const newId = await createMeal({
        date: todayISO(),
        meal_type: result.meal_type ?? autoMealType(),
        logged_at: assembleLoggedAt(todayISO(), mealTime),
        notes: result.description,
        photo_data_url: photoDataUrl,
        source: "photo",
        confidence: result.confidence,
        pert_taken: false,
        entered_by: enteredBy,
        // Parser emits per-eaten-serving macros; createMeal expects
        // per-100 g. Bridge through parsedItemToInline so the values
        // round-trip into meal_items at the right magnitude.
        items: result.items.map((it) => parsedItemToInline(it)),
      });
      router.push(`/nutrition/${newId}?fresh=1`);
    } finally {
      setAutoSaving(false);
    }
  }

  async function saveFromPreview(data: {
    items: PreviewItem[];
    meal_type: MealType;
    description: string;
    pert_taken: boolean;
    confidence: ParsedMealResult["confidence"];
    photo_data_url?: string;
  }) {
    setSaving(true);
    try {
      await createMeal({
        date: todayISO(),
        meal_type: data.meal_type,
        logged_at: assembleLoggedAt(todayISO(), mealTime),
        notes: data.description,
        photo_data_url: data.photo_data_url,
        source: parsedSource,
        confidence: data.confidence,
        pert_taken: data.pert_taken,
        entered_by: enteredBy,
        items: data.items.map((it) => {
          if (it.food_id && it.food_match) {
            return {
              kind: "food" as const,
              food: it.food_match,
              serving_grams: it.serving_grams,
              notes: it.notes,
            };
          }
          // PreviewItem holds per-serving macros (parser convention).
          // Reuse the parser-to-inline bridge so saved meals match the
          // per-100 g schema convention used by `createMeal`.
          return parsedItemToInline({
            name: it.name,
            name_zh: it.name_zh,
            serving_grams: it.serving_grams,
            calories: it.calories,
            protein_g: it.protein_g,
            fat_g: it.fat_g,
            carbs_total_g: it.carbs_total_g,
            fiber_g: it.fiber_g,
            notes: it.notes,
          });
        }),
      });
      router.push("/nutrition");
    } finally {
      setSaving(false);
    }
  }

  async function saveManual() {
    if (manualItems.length === 0) return;
    setSaving(true);
    try {
      await createMeal({
        date: todayISO(),
        meal_type: manualMeal,
        logged_at: assembleLoggedAt(todayISO(), mealTime),
        notes: manualNotes || undefined,
        source: "manual",
        entered_by: enteredBy,
        items: manualItems.map((p) => ({
          kind: "food" as const,
          food: p.food,
          serving_grams: p.serving_grams,
        })),
      });
      router.push("/nutrition");
    } finally {
      setSaving(false);
    }
  }

  const manualTotals = sumItems(
    manualItems.map((p) => {
      const f = p.serving_grams / 100;
      return {
        meal_entry_id: 0,
        food_id: p.food.id,
        food_name: p.food.name,
        serving_grams: p.serving_grams,
        calories: Math.round(p.food.calories * f),
        protein_g: round1(p.food.protein_g * f),
        fat_g: round1(p.food.fat_g * f),
        carbs_total_g: round1(p.food.carbs_total_g * f),
        fiber_g: round1(p.food.fiber_g * f),
        net_carbs_g: round1(p.food.net_carbs_g * f),
        created_at: "",
      };
    }),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === "zh" ? "返回" : "Back"}
      </button>

      <PageHeader
        eyebrow={locale === "zh" ? "新一餐" : "NEW MEAL"}
        title={
          locale === "zh"
            ? "你刚吃了什么？"
            : "What did you just eat?"
        }
        subtitle={
          locale === "zh"
            ? "拍张照片，或者直接说说看。"
            : "Snap a photo or describe it. We'll do the math."
        }
      />

      {/* Time of meal. Defaults to "now" so the common case (logging
       * immediately after eating) is one tap. Editable for after-the-
       * fact logging — eating breakfast at 7 and logging at 11, for
       * example. The picker is light-weight on mobile (native
       * <input type="time">) so the patient doesn't have to scroll
       * a wheel. */}
      <div className="flex items-center gap-3 rounded-md border border-ink-100 bg-paper-2/40 px-3 py-2.5 text-[12px] text-ink-700">
        <Clock className="h-4 w-4 text-ink-400" />
        <span className="text-ink-500">
          {locale === "zh" ? "进餐时间" : "Time eaten"}
        </span>
        <input
          type="time"
          value={mealTime}
          onChange={(e) => setMealTime(e.target.value)}
          className="ml-auto h-9 rounded-md border border-ink-200 bg-paper px-2 text-[13px] text-ink-900 focus:border-ink-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setMealTime(currentHHMM())}
          className="text-[11px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
        >
          {locale === "zh" ? "现在" : "Now"}
        </button>
      </div>

      {autoSaving && (
        <Card className="flex items-center gap-3 px-4 py-3 text-[13px] text-ink-700">
          <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
          {locale === "zh"
            ? "正在保存到营养记录…"
            : "Saving to your nutrition log…"}
        </Card>
      )}

      {parsed ? (
        <ParsedPreview
          parsed={parsed}
          source={parsedSource}
          photoDataUrl={photoUrl}
          onConfirm={saveFromPreview}
          onCancel={() => {
            setParsed(null);
            setPhotoUrl(undefined);
          }}
        />
      ) : (
        <>
          <TemplatesPicker
            date={todayISO()}
            onLogged={() => router.push("/nutrition")}
          />

          <MealIngest
            onParsed={(result, src, photo) => {
              if (src === "photo") {
                // Photo input goes straight into the nutrition tables.
                // The detail screen handles any review / edits.
                void autoSaveFromPhoto(result, photo);
                return;
              }
              setParsed(result);
              setParsedSource(src);
              setPhotoUrl(photo);
            }}
          />

          <details className="group rounded-md border border-ink-100 bg-paper-2/40 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm text-ink-700">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-ink-400" />
                {locale === "zh" ? "或：从食物库添加" : "Or: pick from foods database"}
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(["breakfast", "lunch", "dinner", "snack"] as const).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setManualMeal(m)}
                      className={
                        manualMeal === m
                          ? "rounded-md border border-ink-900 bg-ink-900 px-2.5 py-1 text-[11px] capitalize text-paper"
                          : "rounded-md border border-ink-200 bg-paper px-2.5 py-1 text-[11px] capitalize text-ink-700 hover:border-ink-300"
                      }
                    >
                      {mealLabel(m, locale)}
                    </button>
                  ),
                )}
              </div>

              <FoodPicker
                onPick={(r) =>
                  setManualItems((cur) => [
                    ...cur,
                    { food: r.food, serving_grams: r.serving_grams },
                  ])
                }
              />

              {manualItems.length > 0 && (
                <Card className="space-y-2 px-4 py-3">
                  <ul className="space-y-1.5">
                    {manualItems.map((p, idx) => (
                      <li
                        key={idx}
                        className="flex items-baseline justify-between gap-2 text-[12px]"
                      >
                        <span className="text-ink-700">
                          {locale === "zh" && p.food.name_zh
                            ? p.food.name_zh
                            : p.food.name}{" "}
                          <span className="text-ink-400">
                            · {p.serving_grams}g
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setManualItems((cur) =>
                              cur.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-ink-400 hover:text-[var(--warn,#d97706)]"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline justify-between border-t border-ink-100/60 pt-2 text-[12px]">
                    <span className="text-ink-500">
                      {locale === "zh" ? "合计" : "Total"}
                    </span>
                    <span className="mono text-ink-700">
                      {manualTotals.total_protein_g}g P ·{" "}
                      {manualTotals.total_fat_g}g F ·{" "}
                      {manualTotals.total_net_carbs_g}g NC ·{" "}
                      {manualTotals.total_calories} kcal
                    </span>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder={
                      locale === "zh"
                        ? "备注 (可选)"
                        : "Notes (optional)"
                    }
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                  />
                  <Button onClick={saveManual} disabled={saving} className="w-full">
                    <Check className="h-4 w-4" />
                    {locale === "zh" ? "保存这餐" : "Save meal"}
                  </Button>
                </Card>
              )}
            </div>
          </details>
        </>
      )}
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

// Current local time as "HH:MM" — the value the <input type="time">
// expects. Padded to two digits in each segment.
function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Combine a YYYY-MM-DD day and a HH:MM time into a local-zone ISO
// datetime. We avoid `new Date('2026-04-25T21:40')` because that
// gets interpreted as UTC in some browsers — instead build a Date
// in the user's zone and call toISOString() so the stored value
// round-trips correctly through Dexie + Supabase.
function assembleLoggedAt(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map((s) => Number(s));
  const [hh, mm] = hhmm.split(":").map((s) => Number(s));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}
