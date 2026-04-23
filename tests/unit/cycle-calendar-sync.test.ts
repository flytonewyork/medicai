import { describe, it, expect } from "vitest";
import {
  cycleDayIcsUid,
  deriveCycleAppointments,
} from "~/lib/treatment/calendar-sync";
import type { Protocol, TreatmentCycle } from "~/types/treatment";

const GNP: Protocol = {
  id: "gnp_weekly",
  name: { en: "Gemcitabine + nab-paclitaxel", zh: "吉西他滨 + 白蛋白紫杉醇" },
  short_name: "GnP",
  description: { en: "", zh: "" },
  cycle_length_days: 28,
  dose_days: [1, 8, 15],
  agents: [
    {
      id: "nab_paclitaxel",
      name: "nab-paclitaxel",
      display: { en: "nab-paclitaxel", zh: "白蛋白紫杉醇" },
      typical_dose: "125 mg/m²",
      dose_days: [1, 8, 15],
      route: "IV",
    },
  ],
  phase_windows: [],
  side_effect_profile: { en: "", zh: "" },
  typical_supportive: [],
};

function cycle(overrides: Partial<TreatmentCycle> = {}): TreatmentCycle {
  return {
    id: 42,
    protocol_id: "gnp_weekly",
    cycle_number: 3,
    start_date: "2026-05-04",
    status: "active",
    dose_level: 0,
    created_at: "2026-05-04T00:00:00Z",
    updated_at: "2026-05-04T00:00:00Z",
    ...overrides,
  };
}

describe("deriveCycleAppointments", () => {
  it("emits one chemo appointment per protocol dose day", () => {
    const apps = deriveCycleAppointments(cycle(), GNP);
    expect(apps).toHaveLength(3);
    expect(apps.every((a) => a.kind === "chemo")).toBe(true);
    expect(apps.every((a) => a.derived_from_cycle === true)).toBe(true);
    expect(apps.every((a) => a.cycle_id === 42)).toBe(true);
  });

  it("anchors dates to cycle.start_date (day 1 = start, day 8 = +7 days)", () => {
    const apps = deriveCycleAppointments(cycle(), GNP);
    expect(apps[0]!.starts_at.slice(0, 10)).toBe("2026-05-04");
    expect(apps[1]!.starts_at.slice(0, 10)).toBe("2026-05-11");
    expect(apps[2]!.starts_at.slice(0, 10)).toBe("2026-05-18");
  });

  it("assigns a deterministic ics_uid per dose day so re-sync is idempotent", () => {
    const apps = deriveCycleAppointments(cycle(), GNP);
    expect(apps.map((a) => a.ics_uid)).toEqual([
      cycleDayIcsUid(42, 1),
      cycleDayIcsUid(42, 8),
      cycleDayIcsUid(42, 15),
    ]);
  });

  it("marks a dose day attended when the cycle.day_records flag it administered", () => {
    const apps = deriveCycleAppointments(
      cycle({
        day_records: [
          { day: 1, date: "2026-05-04", administered: true },
          { day: 8, date: "2026-05-11", administered: false },
        ],
      }),
      GNP,
    );
    expect(apps[0]!.status).toBe("attended");
    expect(apps[1]!.status).toBe("scheduled");
    expect(apps[2]!.status).toBe("scheduled");
  });

  it("returns an empty list for cancelled cycles so the calendar doesn't fill with ghosts", () => {
    const apps = deriveCycleAppointments(cycle({ status: "cancelled" }), GNP);
    expect(apps).toHaveLength(0);
  });

  it("dedupes overlapping dose_days coming from the protocol root and from agents", () => {
    const apps = deriveCycleAppointments(cycle(), GNP);
    // GNP has [1,8,15] on both the protocol and its agent — we must
    // still only emit three appointments, not six.
    expect(apps).toHaveLength(3);
  });
});
