"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { CalendarRange, ChevronRight } from "lucide-react";
import { formatWeekRange } from "~/lib/utils/week";

export default function WeeklyListPage() {
  const t = useT();
  const locale = useLocale();
  const assessments = useLiveQuery(() =>
    db.weekly_assessments.orderBy("week_start").reverse().limit(24).toArray(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.weekly")}
        subtitle={
          locale === "zh"
            ? "每周一次 —— 修习、功能、担忧、问题。"
            : "Once a week — practice count, functional self-rating, concerns, questions."
        }
        action={
          <Link href="/weekly/new">
            <Button>
              {locale === "zh" ? "开始本周" : "Start this week"}
            </Button>
          </Link>
        }
      />

      {(!assessments || assessments.length === 0) && (
        <Card className="p-10 text-center">
          <CalendarRange className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有每周记录" : "No weekly entries yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "每周日晚做一次，五分钟。"
              : "Best done Sunday evening. Takes ~5 minutes."}
          </div>
          <Link href="/weekly/new" className="mt-4 inline-block">
            <Button>{locale === "zh" ? "开始第一次" : "Start first one"}</Button>
          </Link>
        </Card>
      )}

      <ul className="space-y-2">
        {(assessments ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={`/weekly/${a.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {formatWeekRange(a.week_start, locale)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {locale === "zh" ? "修习" : "practice"}{" "}
                    {a.practice_full_days + a.practice_reduced_days} / 7
                  </span>
                  <span>
                    {locale === "zh" ? "功能" : "function"}{" "}
                    {a.functional_integrity} / 5
                  </span>
                  <span>
                    {locale === "zh" ? "清明" : "stillness"}{" "}
                    {a.cognitive_stillness} / 5
                  </span>
                  {a.energy_trend && (
                    <span>
                      {locale === "zh"
                        ? { improving: "上升", stable: "稳定", declining: "下降" }[a.energy_trend]
                        : a.energy_trend}
                    </span>
                  )}
                </div>
                {a.concerns && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                    {a.concerns}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
