"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { db } from "~/lib/db/dexie";
import {
  latestDailyEntries,
  latestLabs,
  latestTreatmentCycles,
} from "~/lib/db/queries";
import { useLocale } from "~/hooks/use-translate";
import { useWeather } from "~/hooks/use-weather";
import { Sparkline } from "~/components/ui/sparkline";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { cn } from "~/lib/utils/cn";
import {
  ArrowDown,
  ChevronRight,
  Pill,
  FlaskConical,
  Sun,
  CloudRain,
  Snowflake,
  Utensils,
  Flame,
} from "lucide-react";

function symptomScore(d: {
  pain_current?: number;
  nausea?: number;
  sleep_quality?: number;
  energy?: number;
  mood_clarity?: number;
}): number {
  const pain = d.pain_current ?? 0;
  const nausea = d.nausea ?? 0;
  const fatigue = typeof d.energy === "number" ? 10 - d.energy : 0;
  const sleep = typeof d.sleep_quality === "number" ? 10 - d.sleep_quality : 0;
  const mood = typeof d.mood_clarity === "number" ? 10 - d.mood_clarity : 0;
  return Math.min(10, (pain + nausea + fatigue + sleep + mood) / 5);
}

// Simple liver-derangement thresholds (2–3× typical ULN).
const LFT_FLAGS = {
  alt: 100, // U/L
  ast: 100, // U/L
  bilirubin: 34, // µmol/L (~2× ULN)
} as const;

export function PillarTiles() {
  const locale = useLocale();
  const weather = useWeather();
  const dailies = useLiveQuery(() => latestDailyEntries(7));
  const labs = useLiveQuery(() => latestLabs(7));
  const cycles = useLiveQuery(() => latestTreatmentCycles(1));
  const settings = useLiveQuery(() => db.settings.toArray());

  const ordered = (dailies ?? []).slice().reverse();
  const todayISO = format(new Date(), "yyyy-MM-dd");
  const todayEntry = ordered.find((d) => d.date === todayISO);
  const recentCycle = (cycles ?? [])[0];
  const latestLab = (labs ?? [])[0];
  const baselineWeight = settings?.[0]?.baseline_weight_kg;

  // -- Symptoms 7d -------------------------------------------------------
  const symptomSeries = useMemo(
    () => ordered.map((d) => symptomScore(d)),
    [ordered],
  );
  const symptomAvg =
    symptomSeries.length > 0
      ? symptomSeries.reduce((a, b) => a + b, 0) / symptomSeries.length
      : null;
  const symptomPrior =
    symptomSeries.length >= 6
      ? symptomSeries.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      : null;
  const symptomsVisible = symptomSeries.length >= 4;

  // -- Next infusion -----------------------------------------------------
  const nextInfusion = useMemo(() => {
    if (!recentCycle || recentCycle.status !== "active") return null;
    const protocol = PROTOCOL_BY_ID[recentCycle.protocol_id];
    if (!protocol) return null;
    const cycleDay =
      differenceInCalendarDays(new Date(), parseISO(recentCycle.start_date)) + 1;
    const doseDays = protocol.dose_days;
    const next = doseDays.find((d) => d >= cycleDay);
    if (next === undefined) return null;
    const daysAway = next - cycleDay;
    if (daysAway > 14) return null;
    const date = new Date(parseISO(recentCycle.start_date));
    date.setDate(date.getDate() + next - 1);
    return {
      daysAway,
      label:
        daysAway === 0
          ? locale === "zh"
            ? "今天"
            : "Today"
          : daysAway === 1
            ? locale === "zh"
              ? "明天"
              : "Tomorrow"
            : locale === "zh"
              ? `${daysAway} 天后`
              : `In ${daysAway} days`,
      dateStr:
        locale === "zh"
          ? format(date, "M 月 d 日")
          : format(date, "EEE · d MMM"),
      protocol: protocol.short_name,
      cycleNumber: recentCycle.cycle_number,
    };
  }, [recentCycle, locale]);

  // -- CA 19-9 ----------------------------------------------------------
  const ca199Series = (labs ?? [])
    .slice()
    .reverse()
    .map((l) => l.ca199)
    .filter((v): v is number => typeof v === "number");
  const ca199Latest = ca199Series[ca199Series.length - 1];
  const ca199First = ca199Series[0];
  const ca199Delta =
    ca199Latest && ca199First && ca199First > 0
      ? Math.round(((ca199Latest - ca199First) / ca199First) * 100)
      : null;
  const ca199Visible = typeof ca199Latest === "number";

  // -- LFT flag ---------------------------------------------------------
  const lftFlag = useMemo(() => {
    if (!latestLab) return null;
    const flags: Array<{ label: string; value: number; unit: string }> = [];
    if (typeof latestLab.alt === "number" && latestLab.alt >= LFT_FLAGS.alt) {
      flags.push({ label: "ALT", value: latestLab.alt, unit: "U/L" });
    }
    if (typeof latestLab.ast === "number" && latestLab.ast >= LFT_FLAGS.ast) {
      flags.push({ label: "AST", value: latestLab.ast, unit: "U/L" });
    }
    if (
      typeof latestLab.bilirubin === "number" &&
      latestLab.bilirubin >= LFT_FLAGS.bilirubin
    ) {
      flags.push({
        label: locale === "zh" ? "胆红素" : "Bilirubin",
        value: latestLab.bilirubin,
        unit: "µmol/L",
      });
    }
    if (flags.length === 0) return null;
    return { date: latestLab.date, flags };
  }, [latestLab, locale]);

  // -- Practice today --------------------------------------------------
  const practiceVisible = !!todayEntry;
  const practiceDone = todayEntry
    ? (todayEntry.practice_morning_completed ? 1 : 0) +
      (todayEntry.practice_evening_completed ? 1 : 0)
    : 0;

  // -- Protein gap today -----------------------------------------------
  const proteinTarget =
    typeof baselineWeight === "number" ? Math.round(baselineWeight * 1.2) : null;
  const proteinToday = todayEntry?.protein_grams;
  const proteinGap =
    proteinTarget !== null &&
    typeof proteinToday === "number" &&
    proteinToday < proteinTarget * 0.75;

  // -- Weather tile ----------------------------------------------------
  const weatherTile = useMemo(() => {
    if (!weather) return null;
    const hot = weather.max_temp_c_24h >= 32;
    const cold = weather.min_temp_c_24h <= 5;
    const wet =
      typeof weather.precip_probability_max_today === "number" &&
      weather.precip_probability_max_today >= 70;
    const highUV =
      typeof weather.uv_index_max_today === "number" &&
      weather.uv_index_max_today >= 8;
    if (!hot && !cold && !wet && !highUV) return null;
    const icon = hot ? Flame : cold ? Snowflake : wet ? CloudRain : Sun;
    const title = hot
      ? locale === "zh"
        ? "高温留意补水"
        : "Hot — hydrate well"
      : cold
        ? locale === "zh"
          ? "低温注意冷感异常"
          : "Cold snap — watch cold dysaesthesia"
        : wet
          ? locale === "zh"
            ? "今日多雨"
            : "Rain likely today"
          : locale === "zh"
            ? "紫外线偏强"
            : "High UV today";
    return {
      icon,
      title,
      detail: `${Math.round(weather.min_temp_c_24h)}–${Math.round(weather.max_temp_c_24h)}°C · ${weather.city}`,
    };
  }, [weather, locale]);

  type Tile = { key: string; node: React.ReactNode };
  const tiles: Tile[] = [];

  if (nextInfusion) {
    tiles.push({
      key: "infusion",
      node: (
        <Link
          href="/treatment"
          className="flex min-h-[140px] flex-col gap-2 rounded-[var(--r-lg)] bg-ink-900 p-4 text-paper shadow-sm transition-transform hover:-translate-y-[1px]"
        >
          <div className="flex items-center justify-between">
            <span className="mono text-[10px] uppercase tracking-wider text-ink-300">
              {locale === "zh" ? "下次用药" : "Next infusion"}
            </span>
            <ChevronRight className="h-3 w-3 text-ink-300" />
          </div>
          <div className="serif mt-1.5 text-[26px] leading-none">
            {nextInfusion.label}
          </div>
          <div className="mono num text-[12.5px] text-ink-300">
            {nextInfusion.dateStr}
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] text-ink-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(75%_0.12_140)]" />
            {nextInfusion.protocol} ·{" "}
            {locale === "zh"
              ? `第 ${nextInfusion.cycleNumber} 周期`
              : `Cycle ${nextInfusion.cycleNumber}`}
          </div>
        </Link>
      ),
    });
  }

  if (symptomsVisible && symptomAvg !== null) {
    tiles.push({
      key: "symptoms",
      node: (
        <Link
          href="/daily"
          className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {locale === "zh" ? "症状" : "Symptoms"}
            </span>
            <ChevronRight className="h-3 w-3 text-ink-300" />
          </div>
          <div className="serif num text-4xl leading-none text-ink-900">
            {symptomAvg.toFixed(1)}
            <span className="ml-1 mono text-sm font-normal text-ink-400">
              /10
            </span>
          </div>
          <div className="text-[11.5px] text-ink-500">
            {locale === "zh"
              ? `7 天平均${symptomPrior !== null ? ` · 此前 ${symptomPrior.toFixed(1)}` : ""}`
              : `avg last 7 days${symptomPrior !== null ? ` · was ${symptomPrior.toFixed(1)}` : ""}`}
          </div>
          <div className="mt-auto">
            <Sparkline
              values={symptomSeries}
              stroke="var(--tide-2)"
              fill="oklch(92% 0.025 210 / 0.5)"
            />
          </div>
        </Link>
      ),
    });
  }

  if (lftFlag) {
    tiles.push({
      key: "lft",
      node: (
        <Link
          href="/labs"
          className={cn(
            "a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300",
          )}
          style={{
            background: "var(--warn-soft)",
            borderLeft: "3px solid var(--warn)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {locale === "zh" ? "肝功能异常" : "Liver flag"}
            </span>
            <FlaskConical className="h-3.5 w-3.5 text-[var(--warn)]" />
          </div>
          <div className="serif text-[22px] leading-tight text-ink-900">
            {lftFlag.flags.map((f) => f.label).join(" · ")}
          </div>
          <div className="text-[11.5px] text-ink-700">
            {lftFlag.flags
              .map((f) => `${f.label} ${f.value} ${f.unit}`)
              .join(" · ")}
          </div>
          <div className="mono mt-auto text-[10px] uppercase tracking-wider text-ink-500">
            {locale === "zh" ? "最近化验：" : "Latest labs "}
            {lftFlag.date}
          </div>
        </Link>
      ),
    });
  }

  if (ca199Visible) {
    tiles.push({
      key: "ca199",
      node: (
        <Link
          href="/labs"
          className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">CA 19-9</span>
            {typeof ca199Delta === "number" && ca199Delta < 0 && (
              <ArrowDown
                className="h-3 w-3 text-[var(--ok)]"
                strokeWidth={2.2}
              />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <div className="serif num text-3xl leading-none text-ink-900">
              {typeof ca199Latest === "number" ? ca199Latest : "—"}
            </div>
            <span className="mono text-[11px] text-ink-400 uppercase">
              U/mL
            </span>
          </div>
          <div
            className={
              typeof ca199Delta === "number"
                ? ca199Delta < 0
                  ? "text-[11.5px] font-medium text-[var(--ok)]"
                  : "text-[11.5px] font-medium text-[var(--warn)]"
                : "text-[11.5px] text-ink-400"
            }
          >
            {typeof ca199Delta === "number"
              ? `${ca199Delta > 0 ? "↑" : "↓"} ${Math.abs(ca199Delta)}% ${locale === "zh" ? "自开始" : "since start"}`
              : locale === "zh"
                ? "第一次结果"
                : "first result"}
          </div>
          <div className="mt-auto">
            {ca199Series.length > 1 && (
              <Sparkline
                values={ca199Series}
                stroke="var(--ok)"
                fill="oklch(93% 0.025 160 / 0.5)"
                showDots
                highlight={ca199Series.length - 1}
              />
            )}
          </div>
        </Link>
      ),
    });
  }

  if (practiceVisible) {
    tiles.push({
      key: "practice",
      node: (
        <Link
          href={`/daily/new?date=${todayISO}`}
          className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {locale === "zh" ? "今日修习" : "Practice · today"}
            </span>
            <Pill className="h-3.5 w-3.5 text-ink-300" />
          </div>
          <div className="flex items-baseline gap-1">
            <div className="serif num text-3xl leading-none text-ink-900">
              {practiceDone}
            </div>
            <div className="mono text-[13px] text-ink-400">/ 2</div>
          </div>
          <div className="text-[11.5px] text-ink-500">
            {locale === "zh" ? "晨 + 晚修习" : "Morning + evening practice"}
          </div>
          <div className="mt-auto flex gap-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    i < practiceDone ? "var(--tide-2)" : "var(--ink-100)",
                }}
              />
            ))}
          </div>
        </Link>
      ),
    });
  }

  if (proteinGap && proteinTarget !== null) {
    tiles.push({
      key: "protein",
      node: (
        <Link
          href={`/daily/new?date=${todayISO}`}
          className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {locale === "zh" ? "蛋白质" : "Protein"}
            </span>
            <Utensils className="h-3.5 w-3.5 text-ink-300" />
          </div>
          <div className="flex items-baseline gap-1">
            <div className="serif num text-3xl leading-none text-ink-900">
              {proteinToday}
            </div>
            <span className="mono text-[11px] text-ink-400">
              / {proteinTarget} g
            </span>
          </div>
          <div className="text-[11.5px] text-ink-500">
            {locale === "zh"
              ? "今日进食低于目标 75%"
              : "Below 75% of today's target"}
          </div>
          <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, ((proteinToday ?? 0) / proteinTarget) * 100)}%`,
                background: "var(--warn)",
              }}
            />
          </div>
        </Link>
      ),
    });
  }

  if (weatherTile) {
    const Icon = weatherTile.icon;
    tiles.push({
      key: "weather",
      node: (
        <div className="a-card flex min-h-[140px] flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">
              {locale === "zh" ? "天气" : "Weather"}
            </span>
            <Icon className="h-3.5 w-3.5 text-ink-500" />
          </div>
          <div className="serif text-[18px] leading-tight text-ink-900">
            {weatherTile.title}
          </div>
          <div className="mono mt-auto text-[10px] uppercase tracking-wider text-ink-400">
            {weatherTile.detail}
          </div>
        </div>
      ),
    });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t) => (
        <div key={t.key}>{t.node}</div>
      ))}
    </div>
  );
}
