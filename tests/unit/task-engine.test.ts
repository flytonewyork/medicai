import { describe, it, expect } from "vitest";
import {
  computeTaskInstance,
  getActiveTaskInstances,
  markCompleted,
  nextRecurringDueDate,
} from "~/lib/tasks/engine";
import type { PatientTask } from "~/types/task";
import type { CycleContext } from "~/types/treatment";

function baseTask(overrides: Partial<PatientTask> = {}): PatientTask {
  return {
    title: "Test task",
    category: "admin",
    priority: "normal",
    schedule_kind: "once",
    lead_time_days: 7,
    surface_dashboard: true,
    surface_daily: false,
    active: true,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function cycleCtx(
  startDate: string,
  cycleDay: number,
): CycleContext {
  return {
    cycle: {
      protocol_id: "gnp_weekly",
      cycle_number: 1,
      start_date: startDate,
      status: "active",
      dose_level: 0,
      created_at: startDate + "T00:00:00Z",
      updated_at: startDate + "T00:00:00Z",
    },
    protocol: {
      id: "gnp_weekly",
      name: { en: "GnP weekly", zh: "" },
      short_name: "GnP weekly",
      description: { en: "", zh: "" },
      cycle_length_days: 28,
      agents: [],
      dose_days: [1, 8, 15],
      phase_windows: [
        {
          key: "nadir",
          day_start: 16,
          day_end: 21,
          label: { en: "Nadir", zh: "" },
          description: { en: "", zh: "" },
        },
      ],
      side_effect_profile: { en: "", zh: "" },
      typical_supportive: [],
    },
    cycle_day: cycleDay,
    phase: null,
    is_dose_day: false,
    days_until_next_dose: null,
    days_until_nadir: null,
    applicable_nudges: [],
  };
}

const TODAY = new Date("2026-04-21T10:00:00Z");

describe("computeTaskInstance — one-off", () => {
  it("buckets overdue when due_date is in the past", () => {
    const inst = computeTaskInstance(
      baseTask({ schedule_kind: "once", due_date: "2026-04-15" }),
      TODAY,
      null,
    );
    expect(inst?.bucket).toBe("overdue");
    expect(inst?.days_until_due).toBeLessThan(0);
  });
  it("buckets due_today when due_date is today", () => {
    const inst = computeTaskInstance(
      baseTask({ schedule_kind: "once", due_date: "2026-04-21" }),
      TODAY,
      null,
    );
    expect(inst?.bucket).toBe("due_today");
    expect(inst?.days_until_due).toBe(0);
  });
  it("buckets approaching when within lead_time", () => {
    const inst = computeTaskInstance(
      baseTask({
        schedule_kind: "once",
        due_date: "2026-04-25",
        lead_time_days: 7,
      }),
      TODAY,
      null,
    );
    expect(inst?.bucket).toBe("approaching");
  });
  it("buckets scheduled when further than lead_time away", () => {
    const inst = computeTaskInstance(
      baseTask({
        schedule_kind: "once",
        due_date: "2026-05-30",
        lead_time_days: 7,
      }),
      TODAY,
      null,
    );
    expect(inst?.bucket).toBe("scheduled");
  });
});

describe("computeTaskInstance — recurring", () => {
  it("uses last_completed + interval when completed", () => {
    const due = nextRecurringDueDate(
      baseTask({
        schedule_kind: "recurring",
        recurrence_interval_days: 28,
        last_completed_date: "2026-04-01",
      }),
      TODAY,
    );
    expect(due).toBe("2026-04-29");
  });
  it("rolls forward when last_completed is old", () => {
    const task = baseTask({
      schedule_kind: "recurring",
      recurrence_interval_days: 7,
      last_completed_date: "2025-12-01",
    });
    const due = nextRecurringDueDate(task, TODAY);
    expect(new Date(due).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-04-14").getTime(),
    );
  });
});

describe("computeTaskInstance — cycle_phase", () => {
  it("fires cycle_relevant during nadir", () => {
    const ctx = cycleCtx("2026-04-01", 17);
    const inst = computeTaskInstance(
      baseTask({
        schedule_kind: "cycle_phase",
        cycle_phase: "nadir",
        lead_time_days: 0,
      }),
      new Date("2026-04-17T10:00:00Z"),
      ctx,
    );
    expect(inst?.bucket).toBe("cycle_relevant");
  });
  it("approaches as nadir gets close", () => {
    const ctx = cycleCtx("2026-04-01", 14);
    const inst = computeTaskInstance(
      baseTask({
        schedule_kind: "cycle_phase",
        cycle_phase: "nadir",
        lead_time_days: 3,
      }),
      new Date("2026-04-14T10:00:00Z"),
      ctx,
    );
    expect(inst?.bucket).toBe("approaching");
  });
});

describe("markCompleted", () => {
  it("records completion and advances recurring due_date", () => {
    const t = baseTask({
      schedule_kind: "recurring",
      recurrence_interval_days: 90,
      due_date: "2026-04-15",
    });
    const updated = markCompleted(t, "2026-04-21", "done at clinic");
    expect(updated.last_completed_date).toBe("2026-04-21");
    expect(updated.due_date).toBe("2026-07-20");
    expect(updated.completions).toHaveLength(1);
    expect(updated.completions?.[0]?.note).toBe("done at clinic");
  });
});

describe("getActiveTaskInstances ordering", () => {
  it("puts overdue first, then due_today, then approaching, then scheduled", () => {
    const tasks: PatientTask[] = [
      baseTask({ title: "later", due_date: "2026-06-30", lead_time_days: 7 }),
      baseTask({ title: "overdue", due_date: "2026-04-10", lead_time_days: 7 }),
      baseTask({ title: "today", due_date: "2026-04-21", lead_time_days: 7 }),
      baseTask({
        title: "approaching",
        due_date: "2026-04-25",
        lead_time_days: 7,
      }),
    ];
    const ordered = getActiveTaskInstances(tasks, TODAY, null);
    expect(ordered.map((i) => i.task.title)).toEqual([
      "overdue",
      "today",
      "approaching",
      "later",
    ]);
  });
});
