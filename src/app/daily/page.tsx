"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { latestDailyEntries } from "~/lib/db/queries";
import { formatDate } from "~/lib/utils/date";
import { useLocale, useT } from "~/hooks/use-translate";
import { Button } from "~/components/ui/button";
import { PageHeader } from "~/components/ui/page-header";
import { EmptyState } from "~/components/ui/empty-state";
import { Attribution } from "~/components/shared/attribution";
import { ChevronRight, CalendarDays, Check } from "lucide-react";

export default function DailyPage() {
  const t = useT();
  const locale = useLocale();
  const entries = useLiveQuery(() => latestDailyEntries(60));

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
        <EmptyState
          icon={CalendarDays}
          title={locale === "zh" ? "还没有记录" : "No entries yet"}
          description={
            locale === "zh"
              ? "先开始今天的记录 —— 之后的趋势都以今天为起点。"
              : "Start today's entry — every trend begins here."
          }
          actions={
            <Link href="/daily/new">
              <Button>{t("dashboard.quick_entry")}</Button>
            </Link>
          }
        />
      )}

      <ul className="space-y-2">
        {(entries ?? []).map((e) => (
          <li key={e.id}>
            <Link
              href={`/daily/${e.id}`}
              className="a-row group justify-between"
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
                    <span className="inline-flex items-center gap-1 text-[var(--ok)]">
                      <Check className="h-3 w-3" aria-hidden />
                      {locale === "zh" ? "阻力" : "resistance"}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {e.fever && (
                    <span className="a-chip warn">
                      {locale === "zh" ? "发热" : "fever"}
                    </span>
                  )}
                  {(e.neuropathy_feet || e.neuropathy_hands) && (
                    <span className="a-chip sand">
                      {locale === "zh" ? "神经病变" : "neuropathy"}
                    </span>
                  )}
                  {e.new_bruising && (
                    <span className="a-chip sand">
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
