"use client";

import Link from "next/link";
import { useActiveCycleContext } from "~/hooks/use-active-cycle";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { NudgeCard } from "~/components/treatment/nudge-card";
import { Syringe, ChevronRight } from "lucide-react";
import { db, now } from "~/lib/db/dexie";

export function CycleDayCard() {
  const locale = useLocale();
  const ctx = useActiveCycleContext();

  if (!ctx) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "化疗日程" : "Treatment schedule"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500">
            {locale === "zh"
              ? "设置当前化疗方案，每日看到贴身提示（饮食、卫生、运动、睡眠、情绪）。"
              : "Set your current chemo protocol to get day-by-day contextual nudges (diet, hygiene, exercise, sleep, mental)."}
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/treatment/new">
            <Button size="lg">
              <Syringe className="h-4 w-4" />
              {locale === "zh" ? "设置化疗方案" : "Set protocol"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { cycle, protocol, cycle_day, phase, is_dose_day, days_until_nadir, days_until_next_dose, applicable_nudges } = ctx;
  const topNudges = applicable_nudges.slice(0, 3);

  async function snooze(id: string) {
    if (!cycle.id) return;
    const next = [...(cycle.snoozed_nudge_ids ?? []), id];
    await db.treatment_cycles.update(cycle.id, {
      snoozed_nudge_ids: next,
      updated_at: now(),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {locale === "zh" ? "今天：化疗第 " : "Today · Cycle "}
              {cycle.cycle_number}
              {locale === "zh" ? " 周期，第 " : " · Day "}
              {cycle_day}
              {locale === "zh" ? " 天" : ""}
            </CardTitle>
            <div className="mt-1 text-xs text-slate-500">
              {protocol.name[locale]} · {phase ? phase.label[locale] : ""}
            </div>
          </div>
          <Link
            href={`/treatment/${cycle.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {locale === "zh" ? "查看" : "View"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {is_dose_day && (
            <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white dark:bg-slate-100 dark:text-slate-900">
              {locale === "zh" ? "今日用药" : "Dose day today"}
            </span>
          )}
          {days_until_next_dose !== null && days_until_next_dose > 0 && (
            <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:text-slate-400">
              {locale === "zh"
                ? `下次用药：${days_until_next_dose} 天后`
                : `Next dose in ${days_until_next_dose} d`}
            </span>
          )}
          {days_until_nadir !== null && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {days_until_nadir === 0
                ? locale === "zh"
                  ? "正处骨髓抑制期"
                  : "In nadir window"
                : locale === "zh"
                  ? `${days_until_nadir} 天进入低谷`
                  : `Nadir in ${days_until_nadir} d`}
            </span>
          )}
        </div>

        {topNudges.length > 0 ? (
          <div className="space-y-2">
            {topNudges.map((n) => (
              <NudgeCard key={n.id} nudge={n} onSnooze={snooze} />
            ))}
            {applicable_nudges.length > 3 && (
              <Link
                href={`/treatment/${cycle.id}`}
                className="block text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              >
                {locale === "zh"
                  ? `还有 ${applicable_nudges.length - 3} 条 →`
                  : `${applicable_nudges.length - 3} more →`}
              </Link>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            {locale === "zh"
              ? "今天没有特别提示。继续保持节奏。"
              : "No contextual nudges today. Stay with your rhythm."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
