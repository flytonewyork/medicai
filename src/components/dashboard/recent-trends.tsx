"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { TrendChart } from "~/components/charts/trend-chart";
import { useT } from "~/hooks/use-translate";
import { movingAverage } from "~/lib/calculations/trends";

export function RecentTrends() {
  const t = useT();
  const entries = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(28).toArray(),
  );

  const ordered = useMemo(() => (entries ?? []).slice().reverse(), [entries]);

  const weight = ordered.map((e) => ({
    date: e.date.slice(5),
    value: typeof e.weight_kg === "number" ? e.weight_kg : null,
  }));

  const energyMA = movingAverage(
    ordered.map((e) => e.energy),
    7,
  );
  const energy = ordered.map((e, i) => ({
    date: e.date.slice(5),
    value: energyMA[i] ?? e.energy,
  }));

  const practice = ordered.map((e) => ({
    date: e.date.slice(5),
    value:
      (e.practice_morning_completed ? 1 : 0) +
      (e.practice_evening_completed ? 1 : 0),
  }));

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 text-center">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TrendChart data={weight} label="Weight (kg)" domain={["auto", "auto"]} />
      <TrendChart data={energy} label="Energy (7-day MA)" domain={[0, 10]} />
      <TrendChart data={practice} label="Practice (sessions/day)" domain={[0, 2]} />
    </div>
  );
}
