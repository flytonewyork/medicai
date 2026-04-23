import { describe, it, expect } from "vitest";
import {
  findAttendance,
  nextStatus,
  setAttendance,
  statusFor,
} from "~/lib/appointments/attendance";
import type { AppointmentAttendance } from "~/types/appointment";

const NOW = new Date("2026-04-23T12:00:00.000Z");

const thomas: AppointmentAttendance = {
  name: "Thomas",
  user_id: "uid-thomas",
  status: "confirmed",
  claimed_at: NOW.toISOString(),
};

describe("findAttendance / statusFor", () => {
  it("matches case-insensitively and trims whitespace", () => {
    const rows = [thomas];
    expect(findAttendance(rows, "THOMAS")?.user_id).toBe("uid-thomas");
    expect(findAttendance(rows, "  thomas  ")?.user_id).toBe("uid-thomas");
  });

  it("returns undefined when the name isn't in the list", () => {
    expect(findAttendance([thomas], "Catherine")).toBeUndefined();
  });

  it("statusFor falls back to 'pending' when no row exists", () => {
    expect(statusFor([thomas], "Catherine")).toBe("pending");
    expect(statusFor(undefined, "anyone")).toBe("pending");
    expect(statusFor([thomas], "thomas")).toBe("confirmed");
  });
});

describe("nextStatus cycle", () => {
  it("cycles pending → confirmed → tentative → declined → pending", () => {
    expect(nextStatus("pending")).toBe("confirmed");
    expect(nextStatus("confirmed")).toBe("tentative");
    expect(nextStatus("tentative")).toBe("declined");
    expect(nextStatus("declined")).toBe("pending");
  });
});

describe("setAttendance", () => {
  it("adds a row when none exists for the name", () => {
    const next = setAttendance([], {
      name: "Catherine",
      user_id: "uid-c",
      status: "tentative",
      now: NOW,
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.status).toBe("tentative");
    expect(next[0]!.claimed_at).toBe(NOW.toISOString());
  });

  it("replaces an existing row for the same name (case-insensitive)", () => {
    const next = setAttendance([thomas], {
      name: "thomas",
      user_id: "uid-thomas",
      status: "declined",
      now: NOW,
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.status).toBe("declined");
  });

  it("removes the row when status flips to 'pending'", () => {
    const next = setAttendance([thomas], {
      name: "Thomas",
      status: "pending",
      now: NOW,
    });
    expect(next).toHaveLength(0);
  });

  it("does not mutate the input array", () => {
    const input: AppointmentAttendance[] = [thomas];
    setAttendance(input, {
      name: "Thomas",
      status: "pending",
      now: NOW,
    });
    expect(input).toHaveLength(1);
  });

  it("leaves unrelated entries alone", () => {
    const rows: AppointmentAttendance[] = [
      thomas,
      {
        name: "Catherine",
        user_id: "uid-c",
        status: "tentative",
        claimed_at: NOW.toISOString(),
      },
    ];
    const next = setAttendance(rows, {
      name: "Thomas",
      status: "pending",
      now: NOW,
    });
    expect(next.map((r) => r.name)).toEqual(["Catherine"]);
  });
});
