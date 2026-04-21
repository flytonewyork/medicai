"use client";

import { useZoneStatus } from "~/hooks/use-zone-status";
import { ZoneBadge } from "~/components/shared/zone-badge";
import { useT } from "~/hooks/use-translate";

export function ZoneStatusCard() {
  const t = useT();
  const { zone, alertCount } = useZoneStatus();
  return (
    <div className="a-card flex items-center justify-between p-5">
      <div>
        <div className="eyebrow">{t("dashboard.current_zone")}</div>
        <div className="mt-2.5">
          <ZoneBadge zone={zone} />
        </div>
      </div>
      <div className="text-right">
        <div className="eyebrow">{t("dashboard.active_alerts")}</div>
        <div className="serif num mt-1 text-3xl text-ink-900">
          {alertCount}
        </div>
      </div>
    </div>
  );
}
