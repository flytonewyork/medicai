"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { PillarRing } from "~/components/assessment/pillar-card";
import { formatDate } from "~/lib/utils/date";
import { ChevronRight, Stethoscope, Clock } from "lucide-react";

export default function AssessmentListPage() {
  const t = useT();
  const locale = useLocale();
  const assessments = useLiveQuery(() =>
    db.comprehensive_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(20)
      .toArray(),
  );

  const hasComplete = (assessments ?? []).some((a) => a.status === "complete");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "综合评估" : "Comprehensive assessment"}
        subtitle={
          locale === "zh"
            ? "自定义测试组合，走完一轮后得到三支柱评分与 Anchor 指数。"
            : "Pick your tests, walk through them, and get three-pillar scores + an Anchor Index."
        }
        action={
          <Link href="/assessment/new">
            <Button size="lg">
              {hasComplete
                ? locale === "zh"
                  ? "开始新一轮"
                  : "Start a new one"
                : locale === "zh"
                  ? "建立基线"
                  : "Establish baseline"}
            </Button>
          </Link>
        }
      />

      {(!assessments || assessments.length === 0) && (
        <Card className="p-10 text-center">
          <Stethoscope className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "尚未做过综合评估" : "No comprehensive assessment yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "第一次评估会建立基线，后续的变化都以此为参照。"
              : "Your first assessment becomes the baseline. Everything after compares against it."}
          </div>
          <Link href="/assessment/new" className="mt-4 inline-block">
            <Button>{locale === "zh" ? "开始" : "Begin"}</Button>
          </Link>
        </Card>
      )}

      <ul className="space-y-3">
        {(assessments ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={a.status === "draft" ? `/assessment/run/${a.id}` : `/assessment/${a.id}`}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              {typeof a.anchor_index === "number" ? (
                <PillarRing score={a.anchor_index} size={56} />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-700">
                  <Clock className="h-5 w-5 text-slate-400" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="text-sm font-semibold">
                  {formatDate(a.assessment_date, locale)} ·{" "}
                  {a.trigger === "baseline" ? (locale === "zh" ? "基线" : "Baseline") : a.trigger}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {(a.tests_completed?.length ?? 0)} /{" "}
                    {(a.tests_included?.length ?? 0)}{" "}
                    {locale === "zh" ? "项已完成" : "complete"}
                  </span>
                  {typeof a.functional_score === "number" && (
                    <span>F {a.functional_score}</span>
                  )}
                  {typeof a.symptom_score === "number" && (
                    <span>S {a.symptom_score}</span>
                  )}
                  {typeof a.toxicity_score === "number" && (
                    <span>T {a.toxicity_score}</span>
                  )}
                  <span
                    className={
                      a.status === "complete"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {a.status === "complete"
                      ? locale === "zh"
                        ? "已完成"
                        : "complete"
                      : locale === "zh"
                        ? "草稿"
                        : "draft"}
                  </span>
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
