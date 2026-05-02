"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Clock, Sun, Moon, Sunrise, Sunset } from "lucide-react";
import { listMealsForDate } from "~/lib/nutrition/queries";
import { Card, CardContent } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import { formatHHMM as formatTime } from "~/lib/utils/date";
import type { MealEntry, MealType } from "~/types/nutrition";

// Visual day-clock for meal timing. Designed for "small frequent meals"
// patterns common in mPDAC-patients (5–6/day): a horizontal 24h ribbon
// with one dot per logged meal. Tap a dot to see what was eaten.
//
// Why this matters clinically: gemcitabine + nab-paclitaxel patients
// who graze tend to maintain weight + protein better than 3-meal
// patients (less appetite-fatigue, less single-meal fat load on the
// pancreas). Surfacing the actual interval pattern helps the patient
// and dietitian spot long gaps that erode total intake.
export function MealTimeline({ date }: { date: string }) {
  const locale = useLocale();
  const mealsRaw = useLiveQuery(
    async () => listMealsForDate(date),
    [date],
  );
  const meals = useMemo(() => mealsRaw ?? [], [mealsRaw]);

  const stats = useMemo(() => buildStats(meals), [meals]);

  if (meals.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--tide-2)]" />
            {locale === "zh" ? "进餐时间线" : "Meal timing"}
          </h2>
          <span className="mono text-[10px] text-ink-400">
            {meals.length}{" "}
            {locale === "zh"
              ? `餐 · 间隔 ${formatGap(stats.avgGapMin, locale)}`
              : `meals · avg gap ${formatGap(stats.avgGapMin, locale)}`}
          </span>
        </div>

        <DayClock meals={meals} locale={locale} />

        <ul className="space-y-1.5">
          {meals.map((m, i) => (
            <li key={m.id}>
              <TimelineRow
                meal={m}
                prev={i > 0 ? meals[i - 1] : null}
                locale={locale}
              />
            </li>
          ))}
        </ul>

        {stats.longestGapMin >= 240 && (
          <p className="rounded-md bg-paper-2/60 px-3 py-2 text-[11px] text-ink-500">
            {locale === "zh"
              ? `今天最长间隔约 ${formatGap(stats.longestGapMin, locale)}。少量多餐能让蛋白和热量摄入更稳。`
              : `Longest gap today: ${formatGap(stats.longestGapMin, locale)}. Smaller, more frequent meals keep intake steadier.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DayClock({
  meals,
  locale,
}: {
  meals: ReadonlyArray<MealEntry>;
  locale: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative h-9">
        {/* Day-shading background. Soft gradient marks daylight hours. */}
        <div className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-r from-ink-100 via-paper-2 via-50% to-ink-100" />
        {/* Hour ticks */}
        {[0, 6, 12, 18, 24].map((h) => (
          <span
            key={h}
            className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-ink-300"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
        {meals.map((m) => {
          const t = parseLocalDate(m.logged_at);
          const pct = ((t.getHours() * 60 + t.getMinutes()) / (24 * 60)) * 100;
          const tone = mealTone(m);
          return (
            <span
              key={m.id}
              className={cn(
                "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper",
                tone,
              )}
              style={{ left: `${pct}%` }}
              title={`${formatTime(t)} · ${m.total_calories} kcal`}
            />
          );
        })}
      </div>
      {/* Hour-axis labels positioned absolutely at the same percentages
       * the ticks above use, so each label's centre lines up with its
       * tick. The earlier `flex justify-between` distributed by box
       * edges, which gives unequal-width children (the icons) different
       * apparent positions than the ticks they label — visually
       * misaligned at 06 and 18. */}
      <div className="mono relative h-3.5 text-[9px] uppercase tracking-wider text-ink-400">
        {([
          { hour: 0, label: "00", icon: null },
          { hour: 6, label: "06", icon: Sunrise },
          { hour: 12, label: "12", icon: Sun },
          { hour: 18, label: "18", icon: Sunset },
          { hour: 24, label: "24", icon: Moon },
        ] as const).map(({ hour, label, icon: Icon }) => (
          <span
            key={hour}
            className="absolute top-0 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  meal,
  prev,
  locale,
}: {
  meal: MealEntry;
  prev: MealEntry | null;
  locale: string;
}) {
  const time = formatTime(parseLocalDate(meal.logged_at));
  const gapMin = prev
    ? Math.round(
        (parseLocalDate(meal.logged_at).getTime() -
          parseLocalDate(prev.logged_at).getTime()) /
          60000,
      )
    : null;
  return (
    <div className="flex items-start gap-3 rounded-md bg-paper-2/40 px-3 py-2">
      <span className="mono w-12 shrink-0 text-[11px] text-ink-500">{time}</span>
      <span
        className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", mealTone(meal))}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink-900">
          {mealLabel(meal.meal_type, locale)}
          <span className="ml-1.5 text-ink-500">
            · {meal.total_calories} kcal · {meal.total_protein_g}g P
          </span>
        </div>
        {meal.notes && (
          <div className="truncate text-[11px] text-ink-500">{meal.notes}</div>
        )}
      </div>
      {gapMin !== null && (
        <span className="mono shrink-0 text-[10px] text-ink-400">
          +{formatGap(gapMin, locale)}
        </span>
      )}
    </div>
  );
}

function mealTone(meal: MealEntry): string {
  // Yellow when fatty meal logged without PERT — visually mirrors the
  // PERT prompt the patient would see in the meal list.
  if (meal.total_fat_g >= 15 && !meal.pert_taken) {
    return "bg-[var(--warn,#d97706)]";
  }
  if (meal.meal_type === "snack") return "bg-ink-400";
  return "bg-[var(--tide-2)]";
}

interface Stats {
  avgGapMin: number;
  longestGapMin: number;
}

function buildStats(meals: ReadonlyArray<MealEntry>): Stats {
  if (meals.length < 2) return { avgGapMin: 0, longestGapMin: 0 };
  const sorted = [...meals].sort((a, b) =>
    a.logged_at.localeCompare(b.logged_at),
  );
  let total = 0;
  let longest = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (parseLocalDate(sorted[i].logged_at).getTime() -
        parseLocalDate(sorted[i - 1].logged_at).getTime()) /
      60000;
    total += gap;
    if (gap > longest) longest = gap;
  }
  return {
    avgGapMin: Math.round(total / (sorted.length - 1)),
    longestGapMin: Math.round(longest),
  };
}

function parseLocalDate(iso: string): Date {
  return new Date(iso);
}

function formatGap(min: number, locale: string): string {
  if (min < 60) return locale === "zh" ? `${min} 分钟` : `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return locale === "zh" ? `${h} 小时` : `${h}h`;
  return locale === "zh" ? `${h}h${m}m` : `${h}h ${m}m`;
}

function mealLabel(m: MealType, locale: string): string {
  if (locale !== "zh") {
    return { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" }[m];
  }
  return { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" }[m];
}
