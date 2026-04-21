"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { getActiveTaskInstances, markCompleted } from "~/lib/tasks/engine";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import type { CycleContext } from "~/types/treatment";
import type { TaskInstance } from "~/types/task";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { now } from "~/lib/db/dexie";
import { todayISO } from "~/lib/utils/date";

function deriveActiveCycleContext(): CycleContext | null {
  // Lightweight context synth without pulling the full engine — just enough
  // for task phase/cycle-day matching. We re-derive elsewhere where needed.
  return null;
}

export function useTaskInstances(): TaskInstance[] {
  const tasks = useLiveQuery(() => db.patient_tasks.toArray());
  const cycles = useLiveQuery(() =>
    db.treatment_cycles
      .orderBy("start_date")
      .reverse()
      .limit(1)
      .toArray(),
  );

  return useMemo(() => {
    const today = new Date();
    const activeCycle = (cycles ?? [])[0];
    let ctx: CycleContext | null = null;
    if (activeCycle && activeCycle.status === "active") {
      const protocol = PROTOCOL_BY_ID[activeCycle.protocol_id];
      if (protocol) {
        const start = parseISO(activeCycle.start_date);
        const cycleDay =
          differenceInCalendarDays(today, start) + 1;
        const phase = protocol.phase_windows.find(
          (p) => cycleDay >= p.day_start && cycleDay <= p.day_end,
        );
        ctx = {
          cycle: activeCycle,
          protocol,
          cycle_day: cycleDay,
          phase: phase ?? null,
          is_dose_day: protocol.dose_days.includes(cycleDay),
          days_until_next_dose: null,
          days_until_nadir: null,
          applicable_nudges: [],
        };
      }
    }
    return getActiveTaskInstances(tasks ?? [], today, ctx);
  }, [tasks, cycles]);
}

export async function completeTaskFromInstance(instance: TaskInstance) {
  const t = instance.task;
  if (!t.id) return;
  const updated = markCompleted(t, todayISO());
  await db.patient_tasks.update(t.id, {
    ...updated,
    updated_at: now(),
  });
}

export async function snoozeTaskFromInstance(
  instance: TaskInstance,
  days: number,
) {
  const t = instance.task;
  if (!t.id) return;
  const snoozeUntil = new Date();
  snoozeUntil.setDate(snoozeUntil.getDate() + days);
  const iso = snoozeUntil.toISOString().slice(0, 10);
  await db.patient_tasks.update(t.id, {
    snoozed_until: iso,
    updated_at: now(),
  });
}

// re-export for convenience
export { deriveActiveCycleContext };
