"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { buildCycleContext } from "~/lib/treatment/engine";
import type { CycleContext } from "~/types/treatment";

export function useActiveCycleContext(): CycleContext | null {
  const cycles = useLiveQuery(() => db.treatment_cycles.toArray());
  const latestDaily = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(1).toArray(),
  );

  return useMemo(() => {
    if (!cycles || cycles.length === 0) return null;
    const today = new Date();
    const active = cycles
      .filter((c) => c.status === "active" || c.status === "planned")
      .sort(
        (a, b) =>
          new Date(b.start_date).valueOf() - new Date(a.start_date).valueOf(),
      )[0];
    if (!active) return null;
    const d = latestDaily?.[0];
    const flags: string[] = [];
    if (d?.fever) flags.push("fever");
    if ((d?.nausea ?? 0) >= 5) flags.push("nausea");
    if ((d?.diarrhoea_count ?? 0) >= 3) flags.push("diarrhoea");
    if (d?.neuropathy_feet || d?.neuropathy_hands) flags.push("neuropathy");
    if ((d?.appetite ?? 10) <= 3) flags.push("low_appetite");
    return buildCycleContext(active, today, flags);
  }, [cycles, latestDaily]);
}
