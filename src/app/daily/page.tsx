"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { formatDate } from "~/lib/utils/date";
import { useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";

export default function DailyPage() {
  const t = useT();
  const locale = useUIStore((s) => s.locale);
  const entries = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(30).toArray(),
  );

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("nav.daily")}</h1>
        <Link
          href="/daily/new"
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium dark:bg-slate-100 dark:text-slate-900"
        >
          {t("dashboard.quick_entry")}
        </Link>
      </div>

      {(!entries || entries.length === 0) && (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-8 text-sm text-slate-500 text-center">
          {t("common.noData")}
        </div>
      )}

      <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {(entries ?? []).map((e) => (
          <li key={e.id}>
            <Link
              href={`/daily/${e.id}`}
              className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{formatDate(e.date, locale)}</div>
                  <div className="text-xs text-slate-500">
                    {locale === "zh" ? "精力" : "energy"} {e.energy} ·{" "}
                    {locale === "zh" ? "睡眠" : "sleep"} {e.sleep_quality}
                    {e.weight_kg ? ` · ${e.weight_kg} kg` : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 text-xs text-slate-500">
                  {e.fever && <span className="text-red-700">fever</span>}
                  {e.neuropathy_feet && <span>neuropathy</span>}
                  {e.new_bruising && <span>bruising</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
