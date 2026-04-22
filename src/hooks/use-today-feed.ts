"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { db } from "~/lib/db/dexie";
import { composeTodayFeed } from "~/lib/nudges/compose";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { NUDGE_LIBRARY } from "~/config/treatment-nudges";
import { todayISO } from "~/lib/utils/date";
import type { FeedItem } from "~/types/feed";
import type { CycleContext, NudgeTemplate } from "~/types/treatment";
import type { CurrentWeather } from "~/lib/weather/open-meteo";

export function useTodayFeed({
  weather,
}: {
  weather: CurrentWeather | null;
}): FeedItem[] {
  const settings = useLiveQuery(() => db.settings.toArray());
  const dailies = useLiveQuery(() =>
    db.daily_entries.orderBy("date").reverse().limit(28).toArray(),
  );
  const labs = useLiveQuery(() =>
    db.labs.orderBy("date").reverse().limit(10).toArray(),
  );
  const tasks = useLiveQuery(() => db.patient_tasks.toArray());
  const alerts = useLiveQuery(() => db.zone_alerts.toArray());
  const cycles = useLiveQuery(() =>
    db.treatment_cycles.orderBy("start_date").reverse().limit(1).toArray(),
  );
  const agentRuns = useLiveQuery(() =>
    db.agent_runs.orderBy("ran_at").reverse().limit(40).toArray(),
  );

  return useMemo(() => {
    const s = settings?.[0] ?? null;
    const orderedDailies = (dailies ?? []).slice().reverse();
    const orderedLabs = (labs ?? []).slice().reverse();
    const openAlerts = (alerts ?? []).filter((a) => !a.resolved);
    const active = (cycles ?? []).find((c) => c.status === "active") ?? null;

    let ctx: CycleContext | null = null;
    if (active) {
      const protocol = PROTOCOL_BY_ID[active.protocol_id];
      if (protocol) {
        const cycleDay =
          differenceInCalendarDays(new Date(), parseISO(active.start_date)) + 1;
        const phase = protocol.phase_windows.find(
          (p) => cycleDay >= p.day_start && cycleDay <= p.day_end,
        );
        const applicable = NUDGE_LIBRARY.filter((n: NudgeTemplate) =>
          n.protocol_ids.includes(active.protocol_id) &&
          cycleDay >= n.day_range[0] &&
          cycleDay <= n.day_range[1],
        );
        ctx = {
          cycle: active,
          protocol,
          cycle_day: cycleDay,
          phase: phase ?? null,
          is_dose_day: protocol.dose_days.includes(cycleDay),
          days_until_next_dose: null,
          days_until_nadir: null,
          applicable_nudges: applicable,
        };
      }
    }

    return composeTodayFeed({
      todayISO: todayISO(),
      settings: s,
      recentDailies: orderedDailies,
      recentLabs: orderedLabs,
      tasks: tasks ?? [],
      activeAlerts: openAlerts,
      cycleContext: ctx,
      weather,
      agentRuns: agentRuns ?? [],
    });
  }, [settings, dailies, labs, tasks, alerts, cycles, weather, agentRuns]);
}
