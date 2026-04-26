import { describe, it, expect } from "vitest";
import {
  nextAppointment,
  upcomingAppointments,
} from "~/lib/appointments/upcoming";

const NOW = Date.parse("2026-04-26T10:00:00Z");

const ap = (over: {
  starts_at: string;
  status?: string | null;
  id?: number;
}) => ({ id: 1, ...over });

describe("upcomingAppointments", () => {
  it("drops cancelled by default and rows already in the past", () => {
    const out = upcomingAppointments(
      [
        ap({ id: 1, starts_at: "2026-04-26T11:00:00Z" }),
        ap({ id: 2, starts_at: "2026-04-26T09:00:00Z" }), // past
        ap({
          id: 3,
          starts_at: "2026-04-26T12:00:00Z",
          status: "cancelled",
        }),
      ],
      { from: NOW },
    );
    expect(out.map((a) => a.id)).toEqual([1]);
  });

  it("sorts ascending by starts_at", () => {
    const out = upcomingAppointments(
      [
        ap({ id: 1, starts_at: "2026-04-27T11:00:00Z" }),
        ap({ id: 2, starts_at: "2026-04-26T11:00:00Z" }),
        ap({ id: 3, starts_at: "2026-04-28T11:00:00Z" }),
      ],
      { from: NOW },
    );
    expect(out.map((a) => a.id)).toEqual([2, 1, 3]);
  });

  it("excludes additional statuses when supplied", () => {
    const out = upcomingAppointments(
      [
        ap({ id: 1, starts_at: "2026-04-26T11:00:00Z", status: "missed" }),
        ap({ id: 2, starts_at: "2026-04-26T12:00:00Z" }),
      ],
      { from: NOW, excludeStatuses: ["cancelled", "missed"] },
    );
    expect(out.map((a) => a.id)).toEqual([2]);
  });

  it("respects an exclusive upper bound", () => {
    const out = upcomingAppointments(
      [
        ap({ id: 1, starts_at: "2026-04-26T11:00:00Z" }),
        ap({ id: 2, starts_at: "2026-04-30T11:00:00Z" }),
      ],
      { from: NOW, until: NOW + 24 * 3600 * 1000 },
    );
    expect(out.map((a) => a.id)).toEqual([1]);
  });

  it("drops rows with unparseable starts_at", () => {
    const out = upcomingAppointments(
      [
        ap({ id: 1, starts_at: "not-a-date" }),
        ap({ id: 2, starts_at: "2026-04-26T11:00:00Z" }),
      ],
      { from: NOW },
    );
    expect(out.map((a) => a.id)).toEqual([2]);
  });
});

describe("nextAppointment", () => {
  it("returns the earliest upcoming row", () => {
    const a = nextAppointment(
      [
        ap({ id: 1, starts_at: "2026-04-28T11:00:00Z" }),
        ap({ id: 2, starts_at: "2026-04-26T11:00:00Z" }),
      ],
      { from: NOW },
    );
    expect(a?.id).toBe(2);
  });

  it("returns null when nothing matches", () => {
    expect(
      nextAppointment(
        [
          ap({
            id: 1,
            starts_at: "2026-04-26T11:00:00Z",
            status: "cancelled",
          }),
        ],
        { from: NOW },
      ),
    ).toBeNull();
  });
});
