"use client";

import { addDays, format, parseISO } from "date-fns";
import { useLocale } from "~/hooks/use-translate";
import { cn } from "~/lib/utils/cn";
import type { Protocol, TreatmentCycle } from "~/types/treatment";
import { cycleDayFor, currentPhase } from "~/lib/treatment/engine";

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

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px]">
        <Legend colour="bg-slate-900 dark:bg-slate-100" label={locale === "zh" ? "用药日" : "Dose"} />
        <Legend colour="bg-amber-300 dark:bg-amber-700" label={locale === "zh" ? "低谷" : "Nadir"} />
        <Legend colour="bg-emerald-300 dark:bg-emerald-700" label={locale === "zh" ? "恢复" : "Recovery"} />
        <Legend colour="ring-2 ring-slate-900 dark:ring-slate-100" label={locale === "zh" ? "今天" : "Today"} />
      </div>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-14">
        {days.map(({ n, date, phase, isDose }) => {
          const isToday = n === todayDay;
          const nadir = phase?.key === "nadir";
          const recovery = phase?.key === "recovery_late";
          return (
            <div
              key={n}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-md border p-1 text-[10px]",
                isDose
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : nadir
                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                    : recovery
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
                isToday && "ring-2 ring-offset-1 ring-slate-900 dark:ring-slate-100 dark:ring-offset-slate-950",
              )}
              title={`Day ${n} · ${format(date, "d MMM")} · ${phase?.label[locale] ?? ""}`}
            >
              <span className="font-semibold tabular-nums">{n}</span>
              <span className="text-[9px] opacity-80">{format(date, "d/M")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className={cn("h-2.5 w-2.5 rounded-sm", colour)} />
      {label}
    </span>
  );
}
