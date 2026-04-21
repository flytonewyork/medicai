"use client";

import Link from "next/link";
import { useActiveCycleContext } from "~/hooks/use-active-cycle";
import { useLocale } from "~/hooks/use-translate";
import { NudgeCard } from "~/components/treatment/nudge-card";

export function CycleBanner() {
  const locale = useLocale();
  const ctx = useActiveCycleContext();
  if (!ctx) return null;
  const top = ctx.applicable_nudges.slice(0, 2);
  return (
    <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {ctx.protocol.short_name} ·{" "}
          {locale === "zh"
            ? `周期 ${ctx.cycle.cycle_number}，第 ${ctx.cycle_day} 天`
            : `Cycle ${ctx.cycle.cycle_number} · Day ${ctx.cycle_day}`}
          {ctx.phase ? ` · ${ctx.phase.label[locale]}` : ""}
        </span>
        <Link
          href={`/treatment/${ctx.cycle.id}`}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {locale === "zh" ? "查看全部 →" : "View all →"}
        </Link>
      </div>
      {top.length > 0 && (
        <div className="space-y-1.5">
          {top.map((n) => (
            <NudgeCard key={n.id} nudge={n} compact />
          ))}
        </div>
      )}
    </div>
  );
}
