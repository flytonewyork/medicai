import { describe, it, expect } from "vitest";
import { deriveFollowUpTasks } from "~/lib/appointments/follow-up-tasks";
import type { Appointment } from "~/types/appointment";

function appt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    kind: "clinic",
    title: "Clinic",
    starts_at: "2026-04-20T02:00:00.000Z",
    status: "scheduled",
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-04-22T12:00:00.000Z");

describe("deriveFollowUpTasks", () => {
  it("emits a clinic follow-up with doctor name when present", () => {
    const out = deriveFollowUpTasks({
      appointments: [appt({ doctor: "Dr Michael Lee" })],
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toContain("Dr Michael Lee");
    expect(out[0]!.appointment_kind).toBe("clinic");
    expect(out[0]!.due_date).toBe("2026-04-20");
  });

  it("sets a +3 day offset for blood tests", () => {
    const out = deriveFollowUpTasks({
      appointments: [appt({ id: 2, kind: "blood_test", title: "Weekly FBE" })],
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.due_date).toBe("2026-04-23");
    expect(out[0]!.log_tags).toContain("labs");
  });

  it("sets a +5 day offset for scans with high priority", () => {
    const out = deriveFollowUpTasks({
      appointments: [
        appt({ id: 3, kind: "scan", title: "Restaging CT" }),
      ],
      now: NOW,
    });
    expect(out[0]!.due_date).toBe("2026-04-25");
    expect(out[0]!.priority).toBe("high");
  });

  it("skips appointments with followup_logged_at set", () => {
    const out = deriveFollowUpTasks({
      appointments: [
        appt({ followup_logged_at: "2026-04-20T04:00:00.000Z" }),
      ],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it("skips cancelled and rescheduled appointments", () => {
    const out = deriveFollowUpTasks({
      appointments: [
        appt({ id: 1, status: "cancelled" }),
        appt({ id: 2, status: "rescheduled" }),
      ],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it("skips future appointments (prep-tasks handles those)", () => {
    const out = deriveFollowUpTasks({
      appointments: [appt({ starts_at: "2026-04-25T02:00:00.000Z" })],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it("skips stale appointments past the lookback window", () => {
    const out = deriveFollowUpTasks({
      appointments: [appt({ starts_at: "2026-03-01T02:00:00.000Z" })],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it("sorts by due_date ascending", () => {
    const out = deriveFollowUpTasks({
      appointments: [
        appt({ id: 1, kind: "scan", starts_at: "2026-04-15T02:00:00.000Z" }),
        appt({ id: 2, kind: "clinic", starts_at: "2026-04-20T02:00:00.000Z" }),
        appt({ id: 3, kind: "blood_test", starts_at: "2026-04-18T02:00:00.000Z" }),
      ],
      now: NOW,
    });
    const dates = out.map((t) => t.due_date);
    expect(dates).toEqual([...dates].sort());
  });

  it("returns a stable negative synthetic id keyed by appointment id", () => {
    const a = deriveFollowUpTasks({ appointments: [appt({ id: 7 })], now: NOW });
    const b = deriveFollowUpTasks({ appointments: [appt({ id: 7 })], now: NOW });
    expect(a[0]!.id).toBe(b[0]!.id);
    expect(a[0]!.id).toBeLessThan(0);
  });
});
