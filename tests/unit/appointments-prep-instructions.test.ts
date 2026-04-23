import { describe, it, expect } from "vitest";
import {
  activeFast,
  deriveAwaitingPrepTasks,
  hasActivePrep,
  isPrepActive,
  prepStartMs,
  sortPrepForRender,
} from "~/lib/appointments/prep";
import type { Appointment, AppointmentPrep } from "~/types/appointment";

function appt(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    kind: "scan",
    title: "PET CT",
    starts_at: "2026-04-24T07:00:00+10:00",
    status: "scheduled",
    created_at: "2026-04-23T00:00:00.000Z",
    updated_at: "2026-04-23T00:00:00.000Z",
    ...over,
  };
}

describe("prepStartMs", () => {
  it("returns the absolute starts_at when provided", () => {
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      starts_at: "2026-04-24T01:00:00+10:00",
    };
    expect(prepStartMs(appt(), item)).toBe(
      new Date("2026-04-24T01:00:00+10:00").getTime(),
    );
  });

  it("subtracts hours_before from the appointment start", () => {
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      hours_before: 6,
    };
    const apptStart = new Date("2026-04-24T07:00:00+10:00").getTime();
    expect(prepStartMs(appt(), item)).toBe(apptStart - 6 * 3600 * 1000);
  });

  it("returns null when neither anchor is set", () => {
    expect(
      prepStartMs(appt(), { kind: "bring", description: "Bring ID" }),
    ).toBeNull();
  });
});

describe("isPrepActive + hasActivePrep + activeFast", () => {
  const NOW = new Date("2026-04-24T02:00:00+10:00"); // 1h into fast window

  it("reports active when inside the window and before the appointment", () => {
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      hours_before: 6,
    };
    expect(isPrepActive(appt(), item, NOW)).toBe(true);
    expect(hasActivePrep(appt({ prep: [item] }), NOW)).toBe(true);
    expect(activeFast(appt({ prep: [item] }), NOW)?.description).toMatch(/fast/);
  });

  it("reports inactive once completed_at is set", () => {
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      hours_before: 6,
      completed_at: "2026-04-24T01:30:00+10:00",
    };
    expect(isPrepActive(appt(), item, NOW)).toBe(false);
  });

  it("reports inactive before the window opens", () => {
    const before = new Date("2026-04-23T22:00:00+10:00");
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      hours_before: 6,
    };
    expect(isPrepActive(appt(), item, before)).toBe(false);
  });

  it("reports inactive once the appointment has started", () => {
    const after = new Date("2026-04-24T07:30:00+10:00");
    const item: AppointmentPrep = {
      kind: "fast",
      description: "6-hour fast",
      hours_before: 6,
    };
    expect(isPrepActive(appt(), item, after)).toBe(false);
  });

  it("activeFast returns null when the only active prep isn't a fast", () => {
    const item: AppointmentPrep = {
      kind: "arrive_early",
      description: "30 minutes early",
      hours_before: 0.5,
    };
    expect(
      activeFast(
        appt({ prep: [item] }),
        new Date("2026-04-24T06:45:00+10:00"),
      ),
    ).toBeNull();
  });
});

describe("sortPrepForRender", () => {
  const now = new Date("2026-04-24T02:00:00+10:00");
  const fastActive: AppointmentPrep = {
    kind: "fast",
    description: "6-hour fast",
    hours_before: 6,
  };
  const bringLater: AppointmentPrep = {
    kind: "bring",
    description: "Photo ID",
  };
  const doneItem: AppointmentPrep = {
    kind: "companion",
    description: "Need adult companion",
    completed_at: "2026-04-24T00:00:00+10:00",
  };

  it("puts active items first, completed last", () => {
    const sorted = sortPrepForRender(
      appt({ prep: [doneItem, bringLater, fastActive] }),
      now,
    );
    expect(sorted[0]!.kind).toBe("fast");
    expect(sorted[sorted.length - 1]!.kind).toBe("companion");
  });
});

describe("deriveAwaitingPrepTasks", () => {
  const now = new Date("2026-04-23T12:00:00.000Z");

  it("emits a task when prep_info_received === false and event is upcoming", () => {
    const rows = deriveAwaitingPrepTasks({
      appointments: [
        appt({
          id: 7,
          kind: "chemo",
          title: "GnP cycle 4",
          starts_at: "2026-04-29T10:00:00+10:00",
          prep_info_received: false,
          doctor: "Dr Lee",
        }),
      ],
      now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toContain("GnP cycle 4");
    expect(rows[0]!.title).toContain("Dr Lee");
    expect(rows[0]!.priority).toBe("high");
    expect(rows[0]!.derived_from_appointment_id).toBe(7);
  });

  it("skips when prep_info_received is true or undefined", () => {
    const rows = deriveAwaitingPrepTasks({
      appointments: [
        appt({ prep_info_received: true }),
        appt({ id: 2 }),
      ],
      now,
    });
    expect(rows).toHaveLength(0);
  });

  it("skips past, cancelled, and rescheduled appointments", () => {
    const rows = deriveAwaitingPrepTasks({
      appointments: [
        appt({
          id: 1,
          prep_info_received: false,
          starts_at: "2026-04-20T10:00:00+10:00",
        }),
        appt({
          id: 2,
          prep_info_received: false,
          status: "cancelled",
          starts_at: "2026-04-30T10:00:00+10:00",
        }),
        appt({
          id: 3,
          prep_info_received: false,
          status: "rescheduled",
          starts_at: "2026-04-30T10:00:00+10:00",
        }),
      ],
      now,
    });
    expect(rows).toHaveLength(0);
  });

  it("sorts by due date ascending", () => {
    const rows = deriveAwaitingPrepTasks({
      appointments: [
        appt({ id: 1, prep_info_received: false, starts_at: "2026-05-10T10:00:00+10:00" }),
        appt({ id: 2, prep_info_received: false, starts_at: "2026-04-29T10:00:00+10:00" }),
      ],
      now,
    });
    expect(rows.map((r) => r.derived_from_appointment_id)).toEqual([2, 1]);
  });
});
