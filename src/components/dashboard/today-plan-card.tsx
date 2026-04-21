"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { db } from "~/lib/db/dexie";
import { Card } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { cycleDayFor } from "~/lib/treatment/engine";
import type { TreatmentCycle } from "~/types/treatment";
import type { PatientTask } from "~/types/task";
import {
  CheckCircle2,
  Circle,
  Pill,
  Coffee,
  Footprints,
  Droplet,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

type ScheduleItem = {
  time: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "done" | "next" | "prn";
};

const ICON_FOR_CATEGORY: Record<string, React.ComponentType<{ className?: string }>> = {
  pharmacy: Pill,
  nutrition: Coffee,
  physio: Footprints,
  hygiene: Droplet,
  clinical: MessageCircle,
  self_care: Droplet,
};

export function TodayPlanCard() {
  const locale = useLocale();
  const cycles = useLiveQuery(() =>
    db.treatment_cycles.orderBy("start_date").reverse().limit(1).toArray(),
  );
  const tasks = useLiveQuery(() =>
    db.patient_tasks.where("active").notEqual(0).toArray().catch(() =>
      db.patient_tasks.toArray(),
    ),
  );

  const cycle = (cycles ?? [])[0];
  const active =
    cycle && cycle.status === "active" ? cycle : null;

  const { eyebrow, phaseLabel, summary } = useMemo(() => {
    const base = {
      eyebrow: locale === "zh" ? "今日" : "Today",
      phaseLabel: locale === "zh" ? "未排程" : "No active cycle",
      summary:
        locale === "zh"
          ? "专注于基本功 —— 蛋白质、走动、修习、睡眠。"
          : "Focus on the basics — protein, movement, practice, sleep.",
    };
    if (!active) return base;
    const protocol = PROTOCOL_BY_ID[active.protocol_id];
    if (!protocol) return base;
    const cycleDay = cycleDayFor(active.start_date);
    const phase = protocol.phase_windows.find(
      (p) => cycleDay >= p.day_start && cycleDay <= p.day_end,
    );
    const eyebrow =
      locale === "zh"
        ? `今日 · 周期 ${active.cycle_number} 第 ${cycleDay} 天`
        : `Today · Day ${cycleDay} of cycle ${active.cycle_number}`;
    const phaseLabel = phase
      ? phase.label[locale]
      : locale === "zh"
        ? `第 ${cycleDay} 天`
        : `Cycle day ${cycleDay}`;
    const summary =
      phase?.description[locale] ||
      (locale === "zh"
        ? "专注于基本功：蛋白质、走动、修习、睡眠。"
        : "Focus on the basics — protein, movement, practice, sleep.");
    return { eyebrow, phaseLabel, summary };
  }, [active, locale]);

  const scheduleItems: ScheduleItem[] = useMemo(() => {
    const now = new Date();
    const todayDate = format(now, "yyyy-MM-dd");
    const all = (tasks ?? []).filter(
      (t: PatientTask) => t.active && !t.snoozed_until,
    );
    const ordered = all
      .filter((t) => t.due_date && t.due_date === todayDate)
      .slice(0, 4);
    if (ordered.length === 0) return [];
    return ordered.map<ScheduleItem>((t) => {
      const icon = ICON_FOR_CATEGORY[t.category] ?? Circle;
      return {
        time: t.last_completed_date === todayDate ? "—" : "—",
        label: t.title,
        icon,
        tone: t.last_completed_date === todayDate ? "done" : "next",
      };
    });
  }, [tasks]);

  const fallbackSchedule: ScheduleItem[] = [
    {
      time: "08:00",
      label: locale === "zh" ? "早餐 + PERT（如服用）" : "Breakfast + PERT (if prescribed)",
      icon: Pill,
      tone: "done",
    },
    {
      time: "11:30",
      label: locale === "zh" ? "15 分钟轻松步行" : "Gentle 15-min walk",
      icon: Footprints,
    },
    {
      time: "14:00",
      label: locale === "zh" ? "若需止吐" : "Anti-nausea if needed",
      icon: Droplet,
      tone: "prn",
    },
    {
      time: "18:30",
      label: locale === "zh" ? "修习 / 家人时间" : "Practice / family time",
      icon: MessageCircle,
      tone: "next",
    },
  ];

  const itemsToShow =
    scheduleItems.length > 0 ? scheduleItems : fallbackSchedule;

  return (
    <Card className="relative overflow-hidden px-5 py-5">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{eyebrow}</div>
        <span className="a-chip tide">{phaseLabel}</span>
      </div>
      <div className="serif mt-3 text-[22px] leading-[1.25] text-ink-900">
        {summary}
      </div>

      <ul className="mt-4 divide-y divide-ink-100/70">
        {itemsToShow.map((item, i) => {
          const Icon = item.icon;
          return (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <div className="mono num w-10 shrink-0 text-[11px] text-ink-400">
                {item.time}
              </div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 text-[13.5px] font-medium text-ink-900">
                {item.label}
              </div>
              {item.tone === "done" && (
                <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" strokeWidth={2} />
              )}
              {item.tone === "next" && (
                <span className="a-chip tide">
                  {locale === "zh" ? "下一个" : "NEXT"}
                </span>
              )}
              {item.tone === "prn" && (
                <span className="mono text-[10px] uppercase text-ink-400">PRN</span>
              )}
            </li>
          );
        })}
      </ul>

      <Link
        href="/tasks"
        className="mt-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900"
      >
        {locale === "zh" ? "查看全部任务" : "View all tasks"}
        <ChevronRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}
