"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { formatDate } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { PageHeader } from "~/components/ui/page-header";
import { Attribution } from "~/components/shared/attribution";
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
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-ink-400" />
          <div className="text-sm font-medium">
            {locale === "zh" ? "还没有记录" : "No entries yet"}
          </div>
          <div className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
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
              className="group flex items-center justify-between rounded-xl border border-ink-100/70 bg-paper-2 p-4 transition-colors hover:border-ink-300"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">
                    {formatDate(e.date, locale)}
                  </span>
                  <Attribution
                    enteredBy={e.entered_by}
                    enteredByUserId={e.entered_by_user_id}
                    at={e.entered_at}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
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
                    <span className="text-[var(--ok)]">
                      {locale === "zh" ? "阻力 ✓" : "resistance ✓"}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 text-xs">
                  {e.fever && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: "var(--warn-soft)",
                        color: "var(--warn)",
                      }}
                    >
                      {locale === "zh" ? "发热" : "fever"}
                    </span>
                  )}
                  {(e.neuropathy_feet || e.neuropathy_hands) && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: "var(--sand)",
                        color: "oklch(45% 0.06 70)",
                      }}
                    >
                      {locale === "zh" ? "神经病变" : "neuropathy"}
                    </span>
                  )}
                  {e.new_bruising && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        background: "var(--sand)",
                        color: "oklch(45% 0.06 70)",
                      }}
                    >
                      {locale === "zh" ? "瘀斑" : "bruising"}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-400 group-hover:text-ink-700" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
