"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { formatDate } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { PageHeader } from "~/components/ui/page-header";
import { ChevronRight, CalendarDays } from "lucide-react";

export default function DailyPage() {
  const t = useT();
  const locale = useLocale();
  const entries = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(60).toArray(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader
        title={t("nav.daily")}
        subtitle={
          locale === "zh"
            ? "每日检查。两分钟内完成。"
            : "Daily check-in — under two minutes."
        }
        action={
          <Link href="/daily/new">
            <Button>{t("dashboard.quick_entry")}</Button>
          </Link>
        }
      />

      {(!entries || entries.length === 0) && (
        <Card className="p-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有记录" : "No entries yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {locale === "zh"
              ? "先开始今天的记录 —— 之后的趋势都以今天为起点。"
              : "Start today's entry — every trend begins here."}
          </div>
          <Link href="/daily/new" className="mt-4 inline-block">
            <Button>{t("dashboard.quick_entry")}</Button>
          </Link>
        </Card>
      )}

      <ul className="space-y-2">
        {(entries ?? []).map((e) => (
          <li key={e.id}>
            <Link
              href={`/daily/${e.id}`}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {formatDate(e.date, locale)}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {locale === "zh" ? "精力" : "energy"} {e.energy}
                  </span>
                  <span>
                    {locale === "zh" ? "睡眠" : "sleep"} {e.sleep_quality}
                  </span>
                  {typeof e.weight_kg === "number" && <span>{e.weight_kg} kg</span>}
                  {typeof e.protein_grams === "number" && (
                    <span>{e.protein_grams} g protein</span>
                  )}
                  {typeof e.walking_minutes === "number" && e.walking_minutes > 0 && (
                    <span>{e.walking_minutes} min walk</span>
                  )}
                  {e.resistance_training && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {locale === "zh" ? "阻力 ✓" : "resistance ✓"}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 text-xs">
                  {e.fever && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300">
                      fever
                    </span>
                  )}
                  {(e.neuropathy_feet || e.neuropathy_hands) && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      neuropathy
                    </span>
                  )}
                  {e.new_bruising && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      bruising
                    </span>
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
