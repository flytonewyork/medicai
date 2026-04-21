"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useLocale } from "~/hooks/use-translate";
import { useSettings } from "~/hooks/use-settings";
import {
  assessSarcopenia,
  sarcopeniaLevelLabel,
} from "~/lib/calculations/sarcopenia";
import { cn } from "~/lib/utils/cn";
import { Activity, ChevronRight } from "lucide-react";
import Link from "next/link";

const levelColour = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  "at-risk":
    "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  probable:
    "bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  confirmed:
    "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200",
};

export function SarcopeniaCard() {
  const locale = useLocale();
  const latest = useLiveQuery(() =>
    db.fortnightly_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(1)
      .toArray(),
  );
  const settings = useSettings();

  const assessment = assessSarcopenia(
    latest?.[0] ?? null,
    settings ?? null,
  );

  const noData =
    !latest?.[0] ||
    (typeof latest[0].grip_dominant_kg !== "number" &&
      typeof latest[0].sarc_f_total !== "number" &&
      typeof latest[0].gait_speed_ms !== "number" &&
      typeof latest[0].calf_circumference_cm !== "number");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {locale === "zh" ? "肌少症监测" : "Sarcopenia monitoring"}
          </CardTitle>
          <Link
            href="/fortnightly/new"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {locale === "zh" ? "新评估" : "New assessment"}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {noData ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
            <Activity className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              {locale === "zh"
                ? "做一次两周评估 —— SARC-F + 握力 + 小腿围 + 步速，就能给出风险分级。"
                : "Run one fortnightly assessment — SARC-F + grip + calf + gait — to compute risk."}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={cn(
                "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                levelColour[assessment.level],
              )}
            >
              {sarcopeniaLevelLabel(assessment.level, locale)}
            </div>
            {assessment.signals.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {assessment.signals.map((s, i) => (
                  <li key={i}>— {s}</li>
                ))}
              </ul>
            )}
            {assessment.signals.length === 0 &&
              assessment.level === "low" && (
                <div className="text-xs text-slate-500">
                  {locale === "zh"
                    ? "所有指标在阈值以上。继续保持阻力训练和蛋白摄入。"
                    : "All measures above threshold. Keep resistance training + protein going."}
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
