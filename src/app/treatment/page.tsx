"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { formatDate } from "~/lib/utils/date";
import { ChevronRight, Syringe } from "lucide-react";

export default function TreatmentListPage() {
  const locale = useLocale();
  const cycles = useLiveQuery(() =>
    db.treatment_cycles.orderBy("start_date").reverse().toArray(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={locale === "zh" ? "化疗方案" : "Treatment"}
        subtitle={
          locale === "zh"
            ? "方案、周期、与今天相关的提示。"
            : "Protocol, cycles, and today's contextual nudges."
        }
        action={
          <Link href="/treatment/new">
            <Button>{locale === "zh" ? "新建周期" : "Start cycle"}</Button>
          </Link>
        }
      />
      {(!cycles || cycles.length === 0) && (
        <Card className="p-10 text-center">
          <Syringe className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有化疗方案" : "No protocol set"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "选择一个方案，Anchor 会按周期日给出饮食、卫生、运动、睡眠、情绪的贴身提示。"
              : "Pick a protocol and Anchor will surface day-specific nudges across diet, hygiene, exercise, sleep, and mental health."}
          </div>
          <Link href="/treatment/new" className="mt-4 inline-block">
            <Button>{locale === "zh" ? "选择方案" : "Pick a protocol"}</Button>
          </Link>
        </Card>
      )}
      <ul className="space-y-2">
        {(cycles ?? []).map((c) => {
          const proto = PROTOCOL_BY_ID[c.protocol_id];
          return (
            <li key={c.id}>
              <Link
                href={`/treatment/${c.id}`}
                className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {proto?.short_name ?? c.protocol_id} ·{" "}
                    {locale === "zh" ? "周期 " : "Cycle "}
                    {c.cycle_number}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      {locale === "zh" ? "开始：" : "Start "}
                      {formatDate(c.start_date, locale)}
                    </span>
                    <span className="capitalize">{c.status}</span>
                    {c.dose_level !== 0 && (
                      <span>
                        {locale === "zh" ? "减量 " : "Dose level "}
                        {c.dose_level}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
