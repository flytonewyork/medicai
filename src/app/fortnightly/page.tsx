"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { formatDate } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Stethoscope, ChevronRight } from "lucide-react";

export default function FortnightlyListPage() {
  const t = useT();
  const locale = useLocale();
  const assessments = useLiveQuery(() =>
    db.fortnightly_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(24)
      .toArray(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.fortnightly")}
        subtitle={
          locale === "zh"
            ? "每两周一次。功能测试 + ECOG + 人体测量。"
            : "Every two weeks. Functional tests, ECOG, and anthropometrics."
        }
        action={
          <Link href="/fortnightly/new">
            <Button>
              {locale === "zh" ? "开始评估" : "Start assessment"}
            </Button>
          </Link>
        }
      />

      {(!assessments || assessments.length === 0) && (
        <Card className="p-10 text-center">
          <Stethoscope className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有评估记录" : "No assessments yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "第一次测试将作为之后对比的基线。"
              : "Your first measurements establish the baseline that later values compare against."}
          </div>
          <Link href="/fortnightly/new" className="mt-4 inline-block">
            <Button>{locale === "zh" ? "开始第一次评估" : "Start first assessment"}</Button>
          </Link>
        </Card>
      )}

      <ul className="space-y-2">
        {(assessments ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={`/fortnightly/${a.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {formatDate(a.assessment_date, locale)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>ECOG {a.ecog_self}</span>
                  {typeof a.grip_dominant_kg === "number" && (
                    <span>grip {a.grip_dominant_kg} kg</span>
                  )}
                  {typeof a.gait_speed_ms === "number" && (
                    <span>gait {a.gait_speed_ms} m/s</span>
                  )}
                  {typeof a.sit_to_stand_30s === "number" && (
                    <span>STS {a.sit_to_stand_30s}</span>
                  )}
                  {typeof a.neuropathy_grade === "number" && (
                    <span>neuropathy G{a.neuropathy_grade}</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
