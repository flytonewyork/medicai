"use client";

import { addDays, format, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import type { Protocol, TreatmentCycle } from "~/types/treatment";
import { cycleDayFor, currentPhase } from "~/lib/treatment/engine";
import { FlaskConical } from "lucide-react";

type Swatch = {
  bg: string;
  color: string;
  label: { en: string; zh: string };
};

const SWATCHES: Record<string, Swatch> = {
  dose_day: {
    bg: "var(--tide-2)",
    color: "#fff",
    label: { en: "Dose", zh: "用药" },
  },
  post_dose: {
    bg: "var(--tide-soft)",
    color: "var(--tide-2)",
    label: { en: "Post-dose", zh: "用药后" },
  },
  nadir: {
    bg: "var(--sand)",
    color: "oklch(35% 0.04 70)",
    label: { en: "Nadir", zh: "低谷" },
  },
  recovery_early: {
    bg: "var(--tide-soft)",
    color: "var(--tide-2)",
    label: { en: "Recovery", zh: "恢复" },
  },
  recovery_late: {
    bg: "oklch(88% 0.03 150)",
    color: "oklch(38% 0.05 150)",
    label: { en: "Recovery", zh: "恢复" },
  },
  pre_dose: {
    bg: "var(--ink-100)",
    color: "var(--ink-500)",
    label: { en: "Pre-dose", zh: "用药前" },
  },
  rest: {
    bg: "var(--ink-100)",
    color: "var(--ink-400)",
    label: { en: "Rest", zh: "休息" },
  },
};

const LEGEND_KEYS = [
  "dose_day",
  "post_dose",
  "nadir",
  "recovery_late",
  "rest",
];

export function CycleCalendar({
  cycle,
  protocol,
}: {
  cycle: TreatmentCycle;
  protocol: Protocol;
}) {
  const locale = useLocale();
  const today = new Date();
  const todayDay = cycleDayFor(cycle.start_date, today);
  const start = parseISO(cycle.start_date);

  const days = Array.from({ length: protocol.cycle_length_days }, (_, i) => {
    const n = i + 1;
    const date = addDays(start, i);
    const phase = currentPhase(protocol, n);
    const isDose = protocol.dose_days.includes(n);
    return { n, date, phase, isDose };
  });

  // Lab draw markers — any lab row whose date falls inside this cycle window.
  const cycleEnd = addDays(start, protocol.cycle_length_days - 1);
  const cycleStartStr = cycle.start_date;
  const cycleEndStr = format(cycleEnd, "yyyy-MM-dd");
  const labsInCycle = useLiveQuery(
    () =>
      db.labs
        .where("date")
        .between(cycleStartStr, cycleEndStr, true, true)
        .toArray(),
    [cycleStartStr, cycleEndStr],
  );
  const labDays = new Set(
    (labsInCycle ?? []).map((l) =>
      // Day number within this cycle
      Math.max(
        1,
        Math.min(
          protocol.cycle_length_days,
          Math.floor(
            (parseISO(l.date).getTime() - start.getTime()) / 86400000,
          ) + 1,
        ),
      ),
    ),
  );

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ n, date, phase, isDose }) => {
          const isToday = n === todayDay;
          const key = isDose ? "dose_day" : phase?.key ?? "rest";
          const swatch = SWATCHES[key] ?? SWATCHES.rest!;
          const hasLab = labDays.has(n);
          return (
            <div
              key={n}
              className="relative flex aspect-square flex-col items-center justify-center rounded-[10px]"
              style={{
                background: swatch.bg,
                color: swatch.color,
                boxShadow: isToday ? "0 0 0 2px var(--ink-900)" : undefined,
              }}
              title={[
                `Day ${n} · ${format(date, "d MMM")}`,
                phase?.label[locale],
                hasLab ? (locale === "zh" ? "化验" : "lab draw") : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <span className="mono text-[9px] uppercase opacity-70">
                D{n}
              </span>
              <span className="num text-[15px] font-semibold leading-none">
                {format(date, "d")}
              </span>
              {hasLab && (
                <span
                  className="absolute bottom-1 right-1 flex h-3 w-3 items-center justify-center rounded-full"
                  style={{
                    background: "var(--ink-900)",
                    color: "var(--paper)",
                  }}
                  aria-label={locale === "zh" ? "化验" : "lab"}
                >
                  <FlaskConical className="h-2 w-2" strokeWidth={2.5} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-3.5 border-t border-ink-100/70 pt-3.5 text-[11px] text-ink-500">
        {LEGEND_KEYS.map((k) => {
          const s = SWATCHES[k];
          if (!s) return null;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[3px]"
                style={{ background: s.bg }}
              />
              {s.label[locale]}
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <span
            className="flex h-3 w-3 items-center justify-center rounded-full"
            style={{ background: "var(--ink-900)", color: "var(--paper)" }}
          >
            <FlaskConical className="h-2 w-2" strokeWidth={2.5} />
          </span>
          {locale === "zh" ? "化验" : "Lab draw"}
        </div>
      </div>
    </div>
  );
}
