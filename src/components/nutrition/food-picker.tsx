"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { searchFoods } from "~/lib/nutrition/queries";
import { foodHint, scaleByGrams } from "~/lib/nutrition/calculator";
import { cn } from "~/lib/utils/cn";
import { useLocale } from "~/hooks/use-translate";
import type { FoodItem } from "~/types/nutrition";
import { Button } from "~/components/ui/button";
import { TextInput } from "~/components/ui/field";
import { FoodThumb } from "./food-thumb";

const HINT_TONE_CLS: Record<string, string> = {
  good: "bg-[var(--tide-2)]/15 text-[var(--tide-2)]",
  ok: "bg-ink-100 text-ink-700",
  watch: "bg-[var(--warn,#d97706)]/15 text-[var(--warn,#d97706)]",
  avoid: "bg-ink-200 text-ink-700",
};

export interface FoodPickResult {
  food: FoodItem;
  serving_grams: number;
}

// Search → tap → adjust grams → confirm. Designed for thumbs on a
// mobile screen. Results re-sort with "good first" so the patient
// can pick a low-net-carb option quickly.
export function FoodPicker({
  onPick,
  ketoOnly = false,
  easyDigestOnly = false,
  className,
}: {
  onPick: (result: FoodPickResult) => void;
  ketoOnly?: boolean;
  easyDigestOnly?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState(100);

  useEffect(() => {
    let cancelled = false;
    searchFoods(query, { limit: 30, ketoOnly, easyDigestOnly }).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [query, ketoOnly, easyDigestOnly]);

  useEffect(() => {
    if (selected?.default_serving_g) setGrams(selected.default_serving_g);
  }, [selected?.id, selected?.default_serving_g]);

  const macros = useMemo(
    () => (selected ? scaleByGrams(selected, grams) : null),
    [selected, grams],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <TextInput
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={locale === "zh" ? "搜索食物…" : "Search foods…"}
          className="pl-9"
        />
      </div>

      {!selected ? (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {results.map((f) => {
            const hint = foodHint(f);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected(f)}
                  className="flex w-full items-center gap-3 rounded-md border border-ink-100 bg-paper-2/40 px-3 py-2.5 text-left transition-colors hover:border-ink-300"
                >
                  <FoodThumb food={f} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {locale === "zh" && f.name_zh ? f.name_zh : f.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-500">
                      {f.protein_g}g P · {f.fat_g}g F · {f.net_carbs_g}g net C ·{" "}
                      {f.calories} kcal /100g
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      HINT_TONE_CLS[hint.tone],
                    )}
                  >
                    {hint.label[locale === "zh" ? "zh" : "en"] ?? hint.label.en}
                  </span>
                </button>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-ink-400">
              {locale === "zh" ? "没有匹配项" : "No matches"}
            </li>
          )}
        </ul>
      ) : (
        <div className="space-y-3 rounded-md border border-ink-200 bg-paper-2/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink-900">
                {locale === "zh" && selected.name_zh
                  ? selected.name_zh
                  : selected.name}
              </div>
              {selected.default_serving_label && (
                <div className="text-[11px] text-ink-500">
                  {selected.default_serving_label}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-wide text-ink-500">
              {locale === "zh" ? "重量 (g)" : "Weight (g)"}
            </label>
            <input
              type="number"
              min={1}
              value={grams}
              onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 w-24 rounded-md border border-ink-200 bg-paper px-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none"
            />
            <div className="ml-auto flex gap-1">
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrams(g)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px]",
                    grams === g
                      ? "border-ink-900 bg-ink-900 text-paper"
                      : "border-ink-200 bg-paper text-ink-700 hover:border-ink-300",
                  )}
                >
                  {g}g
                </button>
              ))}
            </div>
          </div>

          {macros && (
            <div className="grid grid-cols-4 gap-2 rounded-md bg-paper p-2 text-center">
              <Macro label={locale === "zh" ? "蛋白" : "Protein"} value={`${macros.protein_g}g`} />
              <Macro label={locale === "zh" ? "脂肪" : "Fat"} value={`${macros.fat_g}g`} />
              <Macro label={locale === "zh" ? "净碳" : "Net C"} value={`${macros.net_carbs_g}g`} />
              <Macro label="kcal" value={`${macros.calories}`} />
            </div>
          )}

          {selected.pdac_notes && (
            <p className="rounded-md bg-paper px-3 py-2 text-[12px] leading-snug text-ink-600">
              {locale === "zh" && selected.pdac_notes_zh
                ? selected.pdac_notes_zh
                : selected.pdac_notes}
            </p>
          )}

          <Button
            type="button"
            onClick={() => {
              if (selected && grams > 0) {
                onPick({ food: selected, serving_grams: grams });
                setSelected(null);
                setQuery("");
                setGrams(100);
              }
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4" />
            {locale === "zh" ? "加入这餐" : "Add to meal"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-ink-900">{value}</div>
      <div className="mono mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
    </div>
  );
}
