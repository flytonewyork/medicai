import { describe, expect, it } from "vitest";
import { derivePrepTasks } from "~/lib/appointments/prep-tasks";
import type { Appointment, AppointmentLink } from "~/types/appointment";

const base: Pick<Appointment, "status" | "created_at" | "updated_at"> = {
  status: "scheduled",
  created_at: "2026-04-22T00:00:00.000Z",
  updated_at: "2026-04-22T00:00:00.000Z",
};

function ap(id: number, overrides: Partial<Appointment>): Appointment {
  return {
    id,
    kind: "clinic",
    title: `Appt ${id}`,
    starts_at: "2026-05-01T09:00:00.000Z",
    ...base,
    ...overrides,
  };
}

function link(
  id: number,
  from: number,
  to: number,
  offset?: number,
): AppointmentLink {
  return {
    id,
    from_id: from,
    to_id: to,
    relation: "prep_for",
    offset_days: offset,
    created_at: base.created_at,
  };
}

describe("derivePrepTasks", () => {
  it("uses the prep appointment's own date when both exist", () => {
    const tasks = derivePrepTasks({
      appointments: [
        ap(1, {
          kind: "blood_test",
          title: "FBC + UEC",
          starts_at: "2026-04-29T08:00:00.000Z",
        }),
        ap(2, {
          kind: "chemo",
          title: "Cycle 3 infusion",
          starts_at: "2026-04-30T10:00:00.000Z",
        }),
      ],
      links: [link(10, 1, 2)],
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.due_date).toBe("2026-04-29");
    expect(tasks[0]?.title).toBe("Prep: FBC + UEC");
    expect(tasks[0]?.category).toBe("clinical");
  });

  it("falls back to to.starts_at − offset_days when prep row is missing", () => {
    const tasks = derivePrepTasks({
      appointments: [
        ap(2, {
          kind: "clinic",
          title: "Dr Lee consult",
          starts_at: "2026-04-30T10:00:00.000Z",
        }),
      ],
      // Only the consult row exists; prep appointment hasn't been booked yet.
      links: [link(10, 9999, 2, 2)],
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.due_date).toBe("2026-04-28");
    expect(tasks[0]?.title).toBe("Book prep for Dr Lee consult");
    // default offset is 1; we passed 2, so lead_time_days should reflect it
    expect(tasks[0]?.lead_time_days).toBe(2);
  });

  it("defaults offset_days to 1 when absent", () => {
    const tasks = derivePrepTasks({
      appointments: [
        ap(2, {
          kind: "chemo",
          title: "Cycle 3 infusion",
          starts_at: "2026-04-30T10:00:00.000Z",
        }),
      ],
      links: [link(10, 9999, 2)],
    });
    expect(tasks[0]?.due_date).toBe("2026-04-29");
  });

  it("ignores non-prep relations", () => {
    const tasks = derivePrepTasks({
      appointments: [ap(1, {}), ap(2, {})],
      links: [
        { ...link(10, 1, 2), relation: "follow_up_of" } as AppointmentLink,
      ],
    });
    expect(tasks).toEqual([]);
  });

  it("sorts output by due_date ascending", () => {
    const tasks = derivePrepTasks({
      appointments: [
        ap(1, { starts_at: "2026-05-10T00:00:00.000Z" }),
        ap(2, { starts_at: "2026-05-20T00:00:00.000Z" }),
        ap(3, { kind: "blood_test", starts_at: "2026-05-05T00:00:00.000Z" }),
        ap(4, { kind: "blood_test", starts_at: "2026-05-15T00:00:00.000Z" }),
      ],
      links: [link(10, 3, 1), link(11, 4, 2)],
    });
    expect(tasks.map((t) => t.due_date)).toEqual(["2026-05-05", "2026-05-15"]);
  });

  it("skips links whose to-appointment doesn't exist", () => {
    const tasks = derivePrepTasks({
      appointments: [ap(1, {})],
      links: [link(10, 1, 999)],
    });
    expect(tasks).toEqual([]);
  });
});
