"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { latestDailyEntries } from "~/lib/db/queries";
import { TrendChart } from "~/components/charts/trend-chart";
import { useT } from "~/hooks/use-translate";
import { movingAverage } from "~/lib/calculations/trends";

export function RecentTrends() {
  const t = useT();
  const entries = useLiveQuery(() => latestDailyEntries(28));

  const ordered = useMemo(() => (entries ?? []).slice().reverse(), [entries]);

  const weight = ordered.map((e) => ({
    date: e.date.slice(5),
    value: typeof e.weight_kg === "number" ? e.weight_kg : null,
  }));

  // Energy is now optional per daily_entry — only average the days the
  // patient actually recorded it. Missing days render as a chart gap.
  const energyValues = ordered.map((e) =>
    typeof e.energy === "number" ? e.energy : null,
  );
  const energyMA = movingAverage(
    energyValues.filter((v): v is number => v !== null),
    7,
  );
  // Re-align the moving average back to the ordered-by-date axis, using
  // null for days with no reading.
  let maIdx = 0;
  const energy = ordered.map((e) => {
    const has = typeof e.energy === "number";
    const val = has ? (energyMA[maIdx] ?? e.energy ?? null) : null;
    if (has) maIdx += 1;
    return { date: e.date.slice(5), value: val ?? null };
  });

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
