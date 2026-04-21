"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { PillarRing } from "~/components/assessment/pillar-card";
import { formatDate } from "~/lib/utils/date";
import { ChevronRight, Compass } from "lucide-react";

export function PillarsCard() {
  const locale = useLocale();
  const latest = useLiveQuery(() =>
    db.comprehensive_assessments
      .orderBy("assessment_date")
      .reverse()
      .filter((a) => a.status === "complete")
      .first(),
  );
  const anyAssessment = useLiveQuery(() =>
    db.comprehensive_assessments.count(),
  );

  if (anyAssessment === undefined) return null;

  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "zh" ? "建立基线" : "Establish your baseline"}
          </CardTitle>
          <div className="mt-1 text-sm text-slate-500">
            {locale === "zh"
              ? "综合评估会给出三支柱评分（功能 / 症状 / 毒性）和 Anchor 指数。以后每一轮都会和第一次对比。"
              : "A comprehensive assessment produces three pillar scores (function / symptoms / toxicity) and an Anchor Index that later assessments compare against."}
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/assessment/new">
            <Button size="lg">
              <Compass className="h-4 w-4" />
              {locale === "zh" ? "开始综合评估" : "Start comprehensive assessment"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Anchor Index</CardTitle>
            <div className="mt-1 text-xs text-slate-500">
              {locale === "zh" ? "最近评估：" : "Latest assessment: "}
              {formatDate(latest.assessment_date, locale)}
            </div>
          </div>
          <Link
            href={`/assessment/${latest.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {locale === "zh" ? "查看" : "View"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <PillarRing score={latest.anchor_index ?? 0} size={84} stroke={8} />
          <div className="grid flex-1 grid-cols-3 gap-2 text-xs">
            <Pillar label={locale === "zh" ? "功能" : "Function"} score={latest.functional_score} />
            <Pillar label={locale === "zh" ? "症状" : "Symptoms"} score={latest.symptom_score} />
            <Pillar label={locale === "zh" ? "毒性" : "Toxicity"} score={latest.toxicity_score} />
          </div>
        </div>
        {latest.ai_summary_patient && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            {latest.ai_summary_patient}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Pillar({
  label,
  score,
}: {
  label: string;
  score: number | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {typeof score === "number" ? score : "—"}
      </div>
    </div>
  );
}
