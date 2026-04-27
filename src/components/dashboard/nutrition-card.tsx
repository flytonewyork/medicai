"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Salad, ChevronRight } from "lucide-react";
import { db } from "~/lib/db/dexie";
import { listMealsForDate } from "~/lib/nutrition/queries";
import {
  defaultTargets,
  sumEntries,
} from "~/lib/nutrition/calculator";
import { todayISO } from "~/lib/utils/date";
import { Card, CardContent } from "~/components/ui/card";
import { MacroBar, TargetBar } from "~/components/nutrition/macro-bar";
import { useLocale } from "~/hooks/use-translate";

// Compact one-card surface for the dashboard. Surfaces protein progress
// + net carbs against the patient's target. Tapping the card opens
// the full nutrition surface.
//
// Hidden until the patient has logged at least one meal — on a fresh
// install the "Log a meal" prompt is the FAB / Smart capture, not a
// dashboard placeholder. Once any meal is logged the card stays
// visible from then on (today's-meals empty state then becomes a
// useful "log another" CTA rather than dead UI).
export function NutritionCard() {
  const locale = useLocale();
  const today = todayISO();
  const mealsRaw = useLiveQuery(
    async () => listMealsForDate(today),
    [today],
  );
  const totalMealCount = useLiveQuery(() => db.meal_entries.count(), []);
  const meals = useMemo(() => mealsRaw ?? [], [mealsRaw]);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const target = useMemo(
    () => defaultTargets(settings?.baseline_weight_kg),
    [settings?.baseline_weight_kg],
  );
  const totals = useMemo(() => sumEntries(meals), [meals]);
  const proteinPct = (totals.total_protein_g / target.protein_g) * 100;
  const carbPct = (totals.total_net_carbs_g / target.net_carbs_g_max) * 100;

  // Wait for the count query so the card doesn't flicker into a
  // placeholder state before history is known.
  if (totalMealCount === undefined) return null;
  if (meals.length === 0 && totalMealCount === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow flex items-center gap-2">
            <Salad className="h-3.5 w-3.5 text-[var(--tide-2)]" />
            {locale === "zh" ? "今日营养" : "Today's nutrition"}
          </h2>
          <Link
            href="/nutrition"
            className="text-[11px] text-ink-500 hover:text-ink-900"
          >
            {locale === "zh" ? "查看 →" : "Open →"}
          </Link>
        </div>

        {meals.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">
              {locale === "zh"
                ? "今天还没记录。一张照片就够了。"
                : "Nothing logged yet. One photo is enough."}
            </p>
            <Link
              href="/nutrition/log"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-paper hover:bg-ink-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === "zh" ? "记一餐" : "Log a meal"}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="serif text-xl text-ink-900">
                  {totals.total_calories}
                  <span className="ml-1 text-xs font-normal text-ink-500">
                    kcal
                  </span>
                </div>
                <div className="text-[11px] text-ink-500">
                  {totals.meals_count} ·{" "}
                  {locale === "zh" ? "餐数" : "meals"}
                </div>
              </div>
              <div className="text-right text-[11px] text-ink-500">
                {totals.total_protein_g}g P · {totals.total_fat_g}g F ·{" "}
                {totals.total_net_carbs_g}g NC
              </div>
            </div>

            <MacroBar
              protein_g={totals.total_protein_g}
              fat_g={totals.total_fat_g}
              net_carbs_g={totals.total_net_carbs_g}
            />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                    {locale === "zh" ? "蛋白" : "Protein"}
                  </span>
                  <span className="mono text-[10px] text-ink-400">
                    {target.protein_g}g
                  </span>
                </div>
                <TargetBar value={proteinPct} target={100} />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="mono text-[10px] uppercase tracking-wider text-ink-400">
                    {locale === "zh" ? "净碳" : "Net carbs"}
                  </span>
                  <span className="mono text-[10px] text-ink-400">
                    &lt; {target.net_carbs_g_max}g
                  </span>
                </div>
                <TargetBar value={carbPct} target={100} cap />
              </div>
            </div>

            <Link
              href="/nutrition/log"
              className="flex items-center justify-between rounded-md border border-ink-100 bg-paper-2/40 px-3 py-2 text-xs text-ink-700 transition-colors hover:border-ink-300"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3 w-3" />
                {locale === "zh" ? "再记一餐" : "Log another meal"}
              </span>
              <ChevronRight className="h-3 w-3 text-ink-400" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
