"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "~/lib/db/dexie";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { formatWeekRange } from "~/lib/utils/week";
import { ChevronRight, CalendarRange } from "lucide-react";

export function WeeklyCard() {
  const locale = useLocale();
  const latest = useLiveQuery(() =>
    db.weekly_assessments
      .orderBy("week_start")
      .reverse()
      .limit(1)
      .toArray(),
  );
  const w = latest?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {locale === "zh" ? "本周回顾" : "Weekly reflection"}
          </CardTitle>
          <Link
            href="/weekly/new"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {locale === "zh" ? "开始本周" : "Start this week"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {!w ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
            <CalendarRange className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {locale === "zh"
                ? "周日晚做一次 —— 修习天数、功能自评、和想问 Dr Lee 的问题。"
                : "Sunday evening — practice days, functional self-rating, and things to ask Dr Lee."}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {formatWeekRange(w.week_start, locale)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                {locale === "zh" ? "修习" : "practice"}{" "}
                {w.practice_full_days + w.practice_reduced_days}/7
              </span>
              <span>
                {locale === "zh" ? "功能" : "function"}{" "}
                {w.functional_integrity}/5
              </span>
              <span>
                {locale === "zh" ? "清明" : "stillness"}{" "}
                {w.cognitive_stillness}/5
              </span>
              <span>
                {locale === "zh" ? "社交" : "social"}{" "}
                {w.social_practice_integrity}/5
              </span>
              {w.energy_trend && (
                <span>
                  {locale === "zh"
                    ? { improving: "上升", stable: "稳定", declining: "下降" }[w.energy_trend]
                    : w.energy_trend}
                </span>
              )}
            </div>
            {w.concerns && (
              <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <span className="font-medium">
                  {locale === "zh" ? "担忧：" : "Concerns: "}
                </span>
                {w.concerns}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
