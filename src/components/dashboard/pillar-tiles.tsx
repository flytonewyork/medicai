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
import { useLocale } from "~/hooks/use-translate";
import { Sparkline } from "~/components/ui/sparkline";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { ArrowDown, ChevronRight, Pill } from "lucide-react";

function symptomScore(
  d: {
    pain_current?: number;
    nausea?: number;
    sleep_quality?: number;
    energy?: number;
    mood_clarity?: number;
  },
): number {
  // Composite 0–10 symptom-burden proxy: higher = more symptoms.
  const pain = d.pain_current ?? 0;
  const nausea = d.nausea ?? 0;
  const fatigue = typeof d.energy === "number" ? 10 - d.energy : 0;
  const sleep = typeof d.sleep_quality === "number" ? 10 - d.sleep_quality : 0;
  const mood =
    typeof d.mood_clarity === "number" ? 10 - d.mood_clarity : 0;
  // 5-item mean capped to 10
  return Math.min(10, (pain + nausea + fatigue + sleep + mood) / 5);
}

export function PillarTiles() {
  const locale = useLocale();
  const dailies = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(7).toArray(),
  );
  const labs = useLiveQuery(() =>
    db.labs.orderBy("date").reverse().limit(7).toArray(),
  );
  const cycles = useLiveQuery(() =>
    db.treatment_cycles.orderBy("start_date").reverse().limit(1).toArray(),
  );

  const ordered = (dailies ?? []).slice().reverse();
  const recentCycle = (cycles ?? [])[0];

  // Symptom burden — 7-day trend + average
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

  // Next infusion — from active cycle
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
    const date = new Date(parseISO(recentCycle.start_date));
    date.setDate(date.getDate() + next - 1);
    return {
      days: daysAway,
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

  // Latest CA19-9 trend
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

  // Practice completion — proxy for the 4th tile (instead of PERT which isn't modelled)
  const practiceCompleted = useMemo(() => {
    const todayISO = format(new Date(), "yyyy-MM-dd");
    const today = ordered.find((d) => d.date === todayISO);
    if (!today)
      return { done: 0, total: 2, subtitle: locale === "zh" ? "今日未记录" : "No entry yet today" };
    const done =
      (today.practice_morning_completed ? 1 : 0) +
      (today.practice_evening_completed ? 1 : 0);
    return {
      done,
      total: 2,
      subtitle:
        locale === "zh" ? "晨 + 晚修习" : "Morning + evening practice",
    };
  }, [ordered, locale]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Symptoms */}
      <Link
        href="/daily"
        className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">{locale === "zh" ? "症状" : "Symptoms"}</span>
          <ChevronRight className="h-3 w-3 text-ink-300" />
        </div>
        <div className="serif num text-4xl leading-none text-ink-900">
          {symptomAvg !== null ? symptomAvg.toFixed(1) : "—"}
          <span className="ml-1 mono text-sm font-normal text-ink-400">/10</span>
        </div>
        <div className="text-[11.5px] text-ink-500">
          {symptomAvg === null
            ? locale === "zh"
              ? "记录 7 天后出现"
              : "Appears after 7 days of logs"
            : locale === "zh"
              ? `7 天平均${symptomPrior !== null ? ` · 此前 ${symptomPrior.toFixed(1)}` : ""}`
              : `avg last 7 days${symptomPrior !== null ? ` · was ${symptomPrior.toFixed(1)}` : ""}`}
        </div>
        <div className="mt-auto">
          {symptomSeries.length > 0 && (
            <Sparkline
              values={symptomSeries}
              stroke="var(--tide-2)"
              fill="oklch(92% 0.025 210 / 0.5)"
            />
          )}
        </div>
      </Link>

      {/* Next infusion (dark inverted tile) */}
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
          {nextInfusion
            ? nextInfusion.label
            : locale === "zh"
              ? "未排程"
              : "Not scheduled"}
        </div>
        {nextInfusion && (
          <>
            <div className="mono num text-[12.5px] text-ink-300">
              {nextInfusion.dateStr}
            </div>
            <div className="mt-auto flex items-center gap-1.5 text-[11px] text-ink-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(75%_0.12_140)]" />
              {nextInfusion.protocol} ·{" "}
              {locale === "zh" ? `第 ${nextInfusion.cycleNumber} 周期` : `Cycle ${nextInfusion.cycleNumber}`}
            </div>
          </>
        )}
        {!nextInfusion && (
          <div className="mt-auto text-[11px] text-ink-300">
            {locale === "zh"
              ? "在治疗页添加方案"
              : "Add a protocol in Treatment"}
          </div>
        )}
      </Link>

      {/* CA19-9 trend */}
      <Link
        href="/labs"
        className="a-card flex min-h-[140px] flex-col gap-2 p-4 text-left transition-colors hover:border-ink-300"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">CA 19-9</span>
          {typeof ca199Delta === "number" && ca199Delta < 0 && (
            <ArrowDown className="h-3 w-3 text-[var(--ok)]" strokeWidth={2.2} />
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <div className="serif num text-3xl leading-none text-ink-900">
            {typeof ca199Latest === "number" ? ca199Latest : "—"}
          </div>
          <span className="mono text-[11px] text-ink-400 uppercase">U/mL</span>
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
              ? "添加第一次结果"
              : "Add your first result"}
        </div>
        <div className="mt-auto">
          {ca199Series.length > 0 && (
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

      {/* Practice today */}
      <Link
        href="/daily/new"
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
            {practiceCompleted.done}
          </div>
          <div className="mono text-[13px] text-ink-400">
            / {practiceCompleted.total}
          </div>
        </div>
        <div className="text-[11.5px] text-ink-500">
          {practiceCompleted.subtitle}
        </div>
        <div className="mt-auto flex gap-1">
          {Array.from({ length: practiceCompleted.total }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                background:
                  i < practiceCompleted.done
                    ? "var(--tide-2)"
                    : "var(--ink-100)",
              }}
            />
          ))}
        </div>
      </Link>
    </div>
  );
}
