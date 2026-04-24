import { describe, it, expect } from "vitest";
import {
  buildTimelineStream,
  groupByMonth,
} from "~/lib/timeline/stream";
import type { LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type { TreatmentCycle } from "~/types/treatment";

function le(
  id: number,
  event_date: string,
  overrides: Partial<LifeEvent> = {},
): LifeEvent {
  return {
    id,
    title: `event ${id}`,
    event_date,
    category: "family",
    created_at: event_date,
    updated_at: event_date,
    ...overrides,
  };
}

function ap(
  id: number,
  starts_at: string,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id,
    title: `appt ${id}`,
    starts_at,
    kind: "chemo",
    status: "attended",
    ...overrides,
  } as Appointment;
}

function cy(
  id: number,
  start_date: string,
  overrides: Partial<TreatmentCycle> = {},
): TreatmentCycle {
  return {
    id,
    cycle_number: 1,
    start_date,
    status: "in_progress",
    protocol_id: "GnP",
    ...overrides,
  } as TreatmentCycle;
}

describe("buildTimelineStream", () => {
  it("returns items in reverse chronological order", () => {
    const stream = buildTimelineStream({
      life_events: [le(1, "2025-06-15"), le(2, "2026-02-10"), le(3, "2025-12-01")],
      appointments: [],
      cycles: [],
    });
    expect(stream.map((i) => i.at)).toEqual([
      "2026-02-10",
      "2025-12-01",
      "2025-06-15",
    ]);
  });

  it("includes completed clinical-spine appointments; excludes others", () => {
    const stream = buildTimelineStream({
      life_events: [],
      appointments: [
        ap(1, "2026-01-10T09:00:00Z", { status: "attended", kind: "chemo" }),
        ap(2, "2026-01-12T09:00:00Z", { status: "scheduled", kind: "chemo" }),
        ap(3, "2026-01-13T09:00:00Z", { status: "attended", kind: "other" }),
        ap(4, "2026-01-15T10:00:00Z", { status: "attended", kind: "scan" }),
      ],
      cycles: [],
    });
    expect(stream.map((i) => (i as { id: number }).id)).toEqual([4, 1]);
  });

  it("emits cycle_start and cycle_end when end date present", () => {
    const stream = buildTimelineStream({
      life_events: [],
      appointments: [],
      cycles: [
        cy(7, "2026-01-05", {
          actual_end_date: "2026-02-26",
        }),
      ],
    });
    expect(stream.map((i) => i.kind)).toEqual(["cycle_end", "cycle_start"]);
  });

  it("falls back to planned_end_date when actual_end_date missing", () => {
    const stream = buildTimelineStream({
      life_events: [],
      appointments: [],
      cycles: [
        cy(8, "2026-01-05", { planned_end_date: "2026-01-26" }),
      ],
    });
    const ends = stream.filter((i) => i.kind === "cycle_end");
    expect(ends).toHaveLength(1);
    expect(ends[0]?.at).toBe("2026-01-26");
  });

  it("memories_only filter excludes non-memory life events", () => {
    const stream = buildTimelineStream({
      life_events: [
        le(1, "2026-01-10", { is_memory: true, category: "diary" }),
        le(2, "2026-01-12", { is_memory: false, category: "travel" }),
        le(3, "2026-01-14", { is_memory: true, category: "family" }),
      ],
      appointments: [],
      cycles: [],
      memories_only: true,
    });
    expect(stream.map((i) => (i as { id: number }).id)).toEqual([3, 1]);
  });

  it("mixes all three sources in one chronological stream", () => {
    const stream = buildTimelineStream({
      life_events: [le(1, "2026-02-01")],
      appointments: [ap(10, "2026-01-15T09:00:00Z", { status: "attended" })],
      cycles: [cy(20, "2026-01-01")],
    });
    expect(stream.map((i) => i.kind)).toEqual([
      "life_event",
      "appointment",
      "cycle_start",
    ]);
  });
});

describe("groupByMonth", () => {
  it("groups stream items by YYYY-MM preserving order", () => {
    const stream = buildTimelineStream({
      life_events: [
        le(1, "2026-02-01"),
        le(2, "2026-02-15"),
        le(3, "2026-01-20"),
        le(4, "2025-12-15"),
      ],
      appointments: [],
      cycles: [],
    });
    const grouped = groupByMonth(stream);
    expect(Array.from(grouped.keys())).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
    expect(grouped.get("2026-02")).toHaveLength(2);
    expect(grouped.get("2026-01")).toHaveLength(1);
  });
});
