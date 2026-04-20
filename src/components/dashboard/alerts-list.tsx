"use client";

import { useZoneStatus } from "~/hooks/use-zone-status";
import { ZoneBadge } from "~/components/shared/zone-badge";
import { useT } from "~/hooks/use-translate";
import { useUIStore } from "~/stores/ui-store";
import { formatDateTime } from "~/lib/utils/date";
import { db, now } from "~/lib/db/dexie";

export function AlertsList() {
  const t = useT();
  const locale = useUIStore((s) => s.locale);
  const { alerts } = useZoneStatus();

  async function acknowledge(id: number | undefined) {
    if (!id) return;
    await db.zone_alerts.update(id, {
      acknowledged: true,
      resolved: true,
      resolved_at: now(),
      updated_at: now(),
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-sm text-slate-500 text-center">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">{a.rule_name}</div>
            <ZoneBadge zone={a.zone} />
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {locale === "zh" ? a.recommendation_zh : a.recommendation}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{formatDateTime(a.triggered_at, locale)}</span>
            <button
              type="button"
              onClick={() => acknowledge(a.id)}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t("common.done")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
