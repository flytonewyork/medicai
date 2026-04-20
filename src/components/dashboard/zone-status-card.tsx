"use client";

import { useZoneStatus } from "~/hooks/use-zone-status";
import { ZoneBadge } from "~/components/shared/zone-badge";
import { useT } from "~/hooks/use-translate";

export function ZoneStatusCard() {
  const t = useT();
  const { zone, alertCount } = useZoneStatus();
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {t("dashboard.current_zone")}
        </div>
        <div className="mt-2">
          <ZoneBadge zone={zone} />
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500">{t("dashboard.active_alerts")}</div>
        <div className="text-2xl font-semibold tabular-nums">{alertCount}</div>
      </div>
    </div>
  );
}
