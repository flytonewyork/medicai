"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { listMealsForDate } from "~/lib/nutrition/queries";
import {
  defaultTargets,
  sumEntries,
} from "~/lib/nutrition/calculator";
import { MacroBar, TargetBar } from "./macro-bar";
import { Card, CardContent } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import type { MealEntry } from "~/types/nutrition";

export function DailyTotals({ date }: { date: string }) {
  const locale = useLocale();
  const mealsRaw = useLiveQuery(
    async () => listMealsForDate(date),
    [date],
  );
  const meals = useMemo(() => mealsRaw ?? [], [mealsRaw]);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const target = useMemo(
    () => defaultTargets(settings?.baseline_weight_kg),
    [settings?.baseline_weight_kg],
  );
  const totals = useMemo(() => sumEntries(meals), [meals]);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow">
              {locale === "zh" ? "今日总计" : "Today's totals"}
            </div>
            <div className="serif mt-0.5 text-2xl text-ink-900">
              {totals.total_calories}
              <span className="ml-1 text-sm font-normal text-ink-500">kcal</span>
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-wider text-ink-400">
              {locale === "zh" ? "饭量" : "Meals"}
            </div>
            <div className="text-sm font-medium text-ink-900">
              {totals.meals_count}
            </div>
          </div>
        </div>

        <MacroBar
          protein_g={totals.total_protein_g}
          fat_g={totals.total_fat_g}
          net_carbs_g={totals.total_net_carbs_g}
        />

        <div className="grid grid-cols-3 gap-3">
          <Stat
            label={locale === "zh" ? "蛋白" : "Protein"}
            value={`${totals.total_protein_g}g`}
            target={`${target.protein_g}g`}
            progress={totals.total_protein_g / target.protein_g}
            tone="goal"
          />
          <Stat
            label={locale === "zh" ? "净碳" : "Net carbs"}
            value={`${totals.total_net_carbs_g}g`}
            target={`< ${target.net_carbs_g_max}g`}
            progress={
              totals.total_net_carbs_g / Math.max(1, target.net_carbs_g_max)
            }
            tone="cap"
          />
          <Stat
            label={locale === "zh" ? "脂肪" : "Fat"}
            value={`${totals.total_fat_g}g`}
            target=""
            progress={0}
            tone="info"
          />
        </div>

        <ProteinHint
          actual={totals.total_protein_g}
          target={target.protein_g}
          locale={locale}
        />
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  target,
  progress,
  tone,
}: {
  label: string;
  value: string;
  target: string;
  progress: number;
  tone: "goal" | "cap" | "info";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="mono text-[10px] uppercase tracking-wider text-ink-400">
          {label}
        </div>
        <div className="mono text-[10px] text-ink-400">{target}</div>
      </div>
      <div className="text-base font-semibold text-ink-900">{value}</div>
      {tone !== "info" && (
        <TargetBar value={progress * 100} target={100} cap={tone === "cap"} />
      )}
    </div>
  );
}

function ProteinHint({
  actual,
  target,
  locale,
}: {
  actual: number;
  target: number;
  locale: string;
}) {
  if (actual >= target) {
    return (
      <p className="text-[12px] text-[var(--tide-2)]">
        {locale === "zh"
          ? `蛋白达标 (${target}g)。继续保持。`
          : `Protein target hit (${target}g). Stay the course.`}
      </p>
    );
  }
  const gap = Math.round(target - actual);
  return (
    <p className="text-[12px] text-ink-500">
      {locale === "zh"
        ? `还差约 ${gap}g 蛋白。一份蛋白粉或两个鸡蛋就够了。`
        : `${gap}g of protein to go. A scoop of whey or two eggs covers it.`}
    </p>
  );
}
