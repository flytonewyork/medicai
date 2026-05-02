"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { db } from "~/lib/db/dexie";
import {
  latestAgentRuns,
  latestDailyEntries,
  latestLabs,
  latestTreatmentCycles,
} from "~/lib/db/queries";
import { useSettings } from "~/hooks/use-settings";
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
  const settings = useSettings();
  const dailies = useLiveQuery(() => latestDailyEntries(28));
  const labs = useLiveQuery(() => latestLabs(10));
  const tasks = useLiveQuery(() => db.patient_tasks.toArray());
  const alerts = useLiveQuery(() => db.zone_alerts.toArray());
  const cycles = useLiveQuery(() => latestTreatmentCycles(1));
  const agentRuns = useLiveQuery(() => latestAgentRuns(40));
  const coverageSnoozes = useLiveQuery(() => db.coverage_snoozes.toArray());
  // Used by the fortnightly cadence prompt — fires when no fortnightly
  // has been completed in the last 12 days. Pull a small page (latest
  // 4) since the prompt only cares about the most recent.
  const fortnightlies = useLiveQuery(() =>
    db.fortnightly_assessments
      .orderBy("assessment_date")
      .reverse()
      .limit(4)
      .toArray(),
  );

  return useMemo(() => {
    const s = settings ?? null;
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
      coverageSnoozes: coverageSnoozes ?? [],
      fortnightlies: fortnightlies ?? [],
    });
  }, [
    settings,
    dailies,
    labs,
    tasks,
    alerts,
    cycles,
    weather,
    agentRuns,
    coverageSnoozes,
    fortnightlies,
  ]);
}
