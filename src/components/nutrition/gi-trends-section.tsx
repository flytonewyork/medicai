"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { shiftIsoDate, todayISO } from "~/lib/utils/date";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Sparkline } from "~/components/ui/sparkline";
import { TrendChart } from "~/components/charts/trend-chart";
import {
  buildGiSeries,
  summariseGiSeries,
} from "~/lib/calculations/gi-trends";

const SHORT_WINDOW = 7;
const LONG_WINDOW = 28;

// AI Dietician's analytical surface for end-to-end input → output.
// Renders nothing until at least one day in the 28-day window has any
// GI signal, so the section quietly stays out of the way for users who
// haven't started filling stool fields yet.
export function GiTrendsSection() {
  const locale = useLocale();
  const today = todayISO();

  const recent = useLiveQuery(async () => {
    const start = shiftIsoDate(today, -(LONG_WINDOW - 1));
    return db.daily_entries.where("date").between(start, today, true, true).toArray();
  }, [today]);

  const series28 = useMemo(
    () => buildGiSeries(recent ?? [], today, LONG_WINDOW),
    [recent, today],
  );
  const series7 = useMemo(
    () => series28.slice(-SHORT_WINDOW),
    [series28],
  );
  const summary7 = useMemo(() => summariseGiSeries(series7), [series7]);

  if (recent === undefined) return null;
  if (summary7.days_with_data === 0) return null;

  const bristolPoints = series28.map((g) => ({
    date: g.date.slice(5), // MM-DD
    value: g.bristol,
  }));
  const countValues = series7.map((g) => g.count ?? 0);

  return (
    <Card>
      <CardContent className="space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="eyebrow">
            {locale === "zh" ? "消化趋势" : "Digestion trends"}
          </h2>
          <span className="mono text-[10px] text-ink-400">
            {locale === "zh" ? "近 28 天" : "Last 28d"}
          </span>
        </header>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile
            label={locale === "zh" ? "排便/日 (7d)" : "BMs/day (7d)"}
            value={
              summary7.count_avg !== null
                ? summary7.count_avg.toFixed(1)
                : "—"
            }
            tone={
              summary7.count_avg !== null && summary7.count_avg >= 4
                ? "warn"
                : "default"
            }
          />
          <Tile
            label={locale === "zh" ? "Bristol 主形态" : "Bristol mode"}
            value={
              summary7.bristol_mode !== null
                ? bristolLabel(summary7.bristol_mode, locale)
                : "—"
            }
            tone={
              summary7.bristol_mode !== null &&
              (summary7.bristol_mode <= 2 || summary7.bristol_mode >= 6)
                ? "warn"
                : "default"
            }
          />
          <Tile
            label={locale === "zh" ? "胰酶覆盖率" : "PERT coverage"}
            value={
              summary7.pert_coverage !== null
                ? `${Math.round(summary7.pert_coverage * 100)}%`
                : "—"
            }
            tone={
              summary7.pert_coverage !== null && summary7.pert_coverage < 0.7
                ? "warn"
                : "default"
            }
          />
          <Tile
            label={locale === "zh" ? "油脂便天数" : "Oil/film days"}
            value={String(summary7.oil_days)}
            tone={summary7.oil_days >= 2 ? "warn" : "default"}
          />
        </div>

        {/* 28-day Bristol scatter — domain pinned to 1–7 with normal band */}
        <div className="relative">
          <TrendChart
            data={bristolPoints}
            label={
              locale === "zh"
                ? "Bristol 排便形态 · 28 天"
                : "Bristol stool form · 28d"
            }
            domain={[1, 7]}
          />
          <div className="px-4 pb-4 pt-1 text-[10.5px] text-ink-400">
            {locale === "zh"
              ? "1–2 便秘 · 3–5 正常区间 · 6–7 稀便"
              : "1–2 constipated · 3–5 normal band · 6–7 loose"}
          </div>
        </div>

        {/* 7-day count sparkline */}
        <div className="flex items-center justify-between gap-3 rounded-md bg-paper-2/60 p-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-ink-900">
              {locale === "zh"
                ? "排便次数 · 近 7 天"
                : "Bowel motions · last 7d"}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-500">
              {summary7.loose_streak > 0
                ? locale === "zh"
                  ? `稀便连续 ${summary7.loose_streak} 天`
                  : `Loose ${summary7.loose_streak} day${summary7.loose_streak === 1 ? "" : "s"} running`
                : locale === "zh"
                  ? "未见连续稀便"
                  : "No loose streak"}
            </div>
          </div>
          <Sparkline values={countValues} width={140} height={36} showDots />
        </div>

        {/* Footer flags row */}
        {(summary7.urgency_days > 0 || summary7.blood_days > 0) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-ink-500">
            {summary7.urgency_days > 0 && (
              <Flag>
                {locale === "zh"
                  ? `急便 ${summary7.urgency_days} 天 (7d)`
                  : `Urgency ${summary7.urgency_days}d (7d)`}
              </Flag>
            )}
            {summary7.blood_days > 0 && (
              <Flag tone="warn">
                {locale === "zh"
                  ? `血便/黑便 ${summary7.blood_days} 天 (7d) — 请联系团队`
                  : `Blood/black ${summary7.blood_days}d (7d) — call the team`}
              </Flag>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "warn";
}) {
  return (
    <div
      className={
        "rounded-md border bg-paper-2/60 p-2.5 " +
        (tone === "warn"
          ? "border-[var(--warn)]/40"
          : "border-ink-100")
      }
    >
      <div className="mono text-[9.5px] uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-[15px] tabular-nums " +
          (tone === "warn" ? "text-[var(--warn)]" : "text-ink-900")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Flag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 " +
        (tone === "warn"
          ? "border-[var(--warn)]/40 bg-[var(--warn-soft)] text-[var(--warn)]"
          : "border-ink-100 bg-paper-2")
      }
    >
      {children}
    </span>
  );
}

function bristolLabel(n: number, locale: string): string {
  const en = ["", "Hard", "Lumpy", "Cracked", "Smooth", "Soft", "Mushy", "Liquid"];
  const zh = ["", "硬块", "成块", "条裂", "光滑", "软", "糊状", "水样"];
  const arr = locale === "zh" ? zh : en;
  return `${n} · ${arr[n] ?? ""}`;
}

