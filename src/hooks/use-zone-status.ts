"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import type { Zone, ZoneAlert } from "~/types/clinical";
import { highestZone } from "~/lib/rules/engine";

export function useZoneStatus(): {
  zone: Zone;
  alertCount: number;
  alerts: ZoneAlert[];
} {
  const alerts = useLiveQuery(() => db.zone_alerts.toArray()) ?? [];
  const open = alerts.filter((a) => !a.resolved);
  const zone = highestZone(open.map((a) => a.zone));
  return { zone, alertCount: open.length, alerts: open };
}
