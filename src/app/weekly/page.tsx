"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { latestWeeklyAssessments } from "~/lib/db/queries";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { CalendarRange, ChevronRight } from "lucide-react";
import { formatWeekRange } from "~/lib/utils/week";

export default function WeeklyListPage() {
  const t = useT();
  const locale = useLocale();
  const assessments = useLiveQuery(() => latestWeeklyAssessments(24));

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
        <EmptyState
          icon={CalendarRange}
          title={locale === "zh" ? "还没有每周记录" : "No weekly entries yet"}
          description={
            locale === "zh"
              ? "每周日晚做一次，五分钟。"
              : "Best done Sunday evening. Takes ~5 minutes."
          }
          actions={
            <Link href="/weekly/new">
              <Button>
                {locale === "zh" ? "开始第一次" : "Start first one"}
              </Button>
            </Link>
          }
        />
      )}

      <ul className="space-y-2">
        {(assessments ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={`/weekly/${a.id}`}
              className="a-row group justify-between"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium text-ink-900">
                  {formatWeekRange(a.week_start, locale)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
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
                  <div className="text-xs text-ink-600 line-clamp-1">
                    {a.concerns}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-ink-700" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
