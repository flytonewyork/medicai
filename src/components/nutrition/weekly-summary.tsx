"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { listMealsBetween } from "~/lib/nutrition/queries";
import { defaultTargets } from "~/lib/nutrition/calculator";
import { Card, CardContent } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { TargetBar } from "./macro-bar";
import { todayISO } from "~/lib/utils/date";

// 7-day rolling protein and net carbs trend. The numbers that matter
// most for mPDAC+chemo function preservation.
export function WeeklySummary() {
  const locale = useLocale();
  const today = todayISO();
  const start = isoDaysAgo(6);
  const mealsRaw = useLiveQuery(
    async () => listMealsBetween(start, today),
    [start, today],
  );
  const meals = useMemo(() => mealsRaw ?? [], [mealsRaw]);
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const target = defaultTargets(settings?.baseline_weight_kg);

  const days = useMemo(() => {
    const out: Array<{
      date: string;
      protein_g: number;
      net_carbs_g: number;
      calories: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = isoDaysAgo(i);
      const slice = meals.filter((m) => m.date === d);
      out.push({
        date: d,
        protein_g: round1(slice.reduce((s, m) => s + m.total_protein_g, 0)),
        net_carbs_g: round1(slice.reduce((s, m) => s + m.total_net_carbs_g, 0)),
        calories: slice.reduce((s, m) => s + m.total_calories, 0),
      });
    }
    return out;
  }, [meals]);

  const avgProtein = round1(
    days.reduce((s, d) => s + d.protein_g, 0) / Math.max(1, days.length),
  );
  const avgNet = round1(
    days.reduce((s, d) => s + d.net_carbs_g, 0) / Math.max(1, days.length),
  );

  if (meals.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">
            {locale === "zh" ? "本周回顾" : "Last 7 days"}
          </h2>
          <span className="mono text-[10px] text-ink-400">
            {locale === "zh"
              ? `平均 ${avgProtein}g 蛋白 / ${avgNet}g 净碳`
              : `avg ${avgProtein}g P / ${avgNet}g net C`}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const proteinPct = Math.min(
              100,
              (d.protein_g / Math.max(1, target.protein_g)) * 100,
            );
            const carbPct = Math.min(
              100,
              (d.net_carbs_g / Math.max(1, target.net_carbs_g_max)) * 100,
            );
            return (
              <div key={d.date} className="space-y-1 text-center">
                <div className="mono text-[9px] uppercase tracking-wider text-ink-400">
                  {dayLabel(d.date, locale)}
                </div>
                <div className="space-y-1 rounded-md bg-paper-2/60 p-1.5">
                  <TargetBar value={proteinPct} target={100} />
                  <TargetBar value={carbPct} target={100} cap />
                </div>
                <div className="text-[10px] text-ink-500">
                  {d.protein_g}g
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-ink-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--tide-2)]" />
            {locale === "zh" ? "蛋白进度" : "Protein progress"}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-ink-400" />
            {locale === "zh" ? "净碳水进度" : "Net carbs cap"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  if (locale === "zh") {
    return ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  }
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
