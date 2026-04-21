import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type {
  PatientTask,
  TaskBucket,
  TaskCompletion,
  TaskInstance,
} from "~/types/task";
import type { CycleContext } from "~/types/treatment";
import { toISODate } from "~/lib/utils/date";

export function nextRecurringDueDate(task: PatientTask, today: Date): string {
  if (task.schedule_kind !== "recurring") return task.due_date ?? toISODate(today);
  const interval = Math.max(1, task.recurrence_interval_days ?? 30);
  const anchor = task.last_completed_date
    ? parseISO(task.last_completed_date)
    : task.due_date
      ? parseISO(task.due_date)
      : today;
  let due = task.last_completed_date
    ? addDays(anchor, interval)
    : anchor;
  // if in the past, keep rolling forward
  while (differenceInCalendarDays(today, due) > interval) {
    due = addDays(due, interval);
  }
  return toISODate(due);
}

function nextOccurrenceForCyclePhase(
  task: PatientTask,
  ctx: CycleContext,
  today: Date,
): { date: string; reason: string } | null {
  if (task.schedule_kind === "cycle_phase" && task.cycle_phase) {
    const phase = ctx.protocol.phase_windows.find(
      (p) => p.key === task.cycle_phase,
    );
    if (!phase) return null;
    const phaseStartDay = phase.day_start;
    const phaseEndDay = phase.day_end;
    const cycleStart = parseISO(ctx.cycle.start_date);
    const phaseStartDate = addDays(cycleStart, phaseStartDay - 1);
    const phaseEndDate = addDays(cycleStart, phaseEndDay - 1);
    const todayDay = ctx.cycle_day;
    if (todayDay >= phaseStartDay && todayDay <= phaseEndDay) {
      return {
        date: toISODate(today),
        reason: `Currently in ${phase.label.en}`,
      };
    }
    if (todayDay < phaseStartDay) {
      return {
        date: toISODate(phaseStartDate),
        reason: `Approaching ${phase.label.en}`,
      };
    }
    // phase already passed this cycle — return phase start for next cycle
    const nextStart = addDays(phaseStartDate, ctx.protocol.cycle_length_days);
    // phaseEndDate retained for future range-aware surfacing
    void phaseEndDate;
    return {
      date: toISODate(nextStart),
      reason: `Next cycle's ${phase.label.en}`,
    };
  }
  if (task.schedule_kind === "cycle_day" && typeof task.cycle_day === "number") {
    const cycleStart = parseISO(ctx.cycle.start_date);
    const thisCycleDayDate = addDays(cycleStart, task.cycle_day - 1);
    if (ctx.cycle_day <= task.cycle_day) {
      return {
        date: toISODate(thisCycleDayDate),
        reason: `Cycle day ${task.cycle_day}`,
      };
    }
    const nextCycleDayDate = addDays(
      thisCycleDayDate,
      ctx.protocol.cycle_length_days,
    );
    return {
      date: toISODate(nextCycleDayDate),
      reason: `Next cycle's day ${task.cycle_day}`,
    };
  }
  return null;
}

export function computeTaskInstance(
  task: PatientTask,
  today: Date,
  ctx: CycleContext | null,
): TaskInstance | null {
  if (!task.active) return null;

  // Snoozed?
  if (task.snoozed_until) {
    const snoozeUntil = parseISO(task.snoozed_until);
    if (differenceInCalendarDays(snoozeUntil, today) > 0) {
      return {
        task,
        bucket: "snoozed",
        due_on: task.snoozed_until,
        days_until_due: differenceInCalendarDays(snoozeUntil, today),
      };
    }
  }

  let dueOn: string;
  let reason: string | undefined;

  if (task.schedule_kind === "once") {
    dueOn = task.due_date ?? toISODate(today);
  } else if (task.schedule_kind === "recurring") {
    dueOn = nextRecurringDueDate(task, today);
  } else {
    if (!ctx) return null;
    const out = nextOccurrenceForCyclePhase(task, ctx, today);
    if (!out) return null;
    dueOn = out.date;
    reason = out.reason;
  }

  const daysUntil = differenceInCalendarDays(parseISO(dueOn), today);
  const bucket = bucketFor(task, daysUntil, ctx);

  return {
    task,
    bucket,
    due_on: dueOn,
    days_until_due: daysUntil,
    reason,
  };
}

function bucketFor(
  task: PatientTask,
  daysUntil: number,
  ctx: CycleContext | null,
): TaskBucket {
  if (task.schedule_kind === "cycle_phase" || task.schedule_kind === "cycle_day") {
    if (ctx && daysUntil === 0) return "cycle_relevant";
  }
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "due_today";
  if (daysUntil <= task.lead_time_days) return "approaching";
  return "scheduled";
}

export function rankBucket(b: TaskBucket): number {
  switch (b) {
    case "overdue":
      return 0;
    case "due_today":
      return 1;
    case "cycle_relevant":
      return 2;
    case "approaching":
      return 3;
    case "scheduled":
      return 4;
    case "snoozed":
      return 5;
  }
}

export function sortTaskInstances(a: TaskInstance, b: TaskInstance): number {
  const rb = rankBucket(a.bucket) - rankBucket(b.bucket);
  if (rb !== 0) return rb;
  // Within same bucket, priority then due date.
  const prioOrder = { high: 0, normal: 1, low: 2 } as const;
  const rp =
    prioOrder[a.task.priority] - prioOrder[b.task.priority];
  if (rp !== 0) return rp;
  return a.due_on.localeCompare(b.due_on);
}

export function getActiveTaskInstances(
  tasks: PatientTask[],
  today: Date,
  ctx: CycleContext | null,
): TaskInstance[] {
  const out: TaskInstance[] = [];
  for (const t of tasks) {
    const inst = computeTaskInstance(t, today, ctx);
    if (inst) out.push(inst);
  }
  return out.sort(sortTaskInstances);
}

export function markCompleted(
  task: PatientTask,
  completionDate: string,
  note?: string,
): PatientTask {
  const completions: TaskCompletion[] = [
    ...(task.completions ?? []),
    { date: completionDate, note },
  ];
  const update: PatientTask = {
    ...task,
    last_completed_date: completionDate,
    completions,
  };
  if (task.schedule_kind === "recurring") {
    const interval = Math.max(1, task.recurrence_interval_days ?? 30);
    update.due_date = toISODate(
      addDays(parseISO(completionDate), interval),
    );
  }
  return update;
}
