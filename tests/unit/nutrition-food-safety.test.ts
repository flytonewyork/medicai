import { describe, it, expect } from "vitest";
import {
  computeFoodSafetyNudges,
  FOOD_SAFETY_AVOID,
} from "~/lib/nudges/food-safety-nudges";
import type { CycleContext, Protocol } from "~/types/treatment";

const protocol: Protocol = {
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
      label: { en: "Nadir", zh: "低谷" },
      description: { en: "", zh: "" },
    },
  ],
  side_effect_profile: { en: "", zh: "" },
  typical_supportive: [],
};

function ctx(phaseKey: "nadir" | "recovery_early" | "rest" | null): CycleContext {
  const phase =
    phaseKey === null
      ? null
      : {
          key: phaseKey,
          day_start: 16,
          day_end: 21,
          label: { en: phaseKey, zh: phaseKey },
          description: { en: "", zh: "" },
        };
  return {
    cycle: {
      protocol_id: "gnp_weekly",
      cycle_number: 1,
      start_date: "2026-04-01",
      status: "active",
      dose_level: 0,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
    },
    protocol,
    cycle_day: 18,
    phase,
    is_dose_day: false,
    days_until_next_dose: null,
    days_until_nadir: null,
    applicable_nudges: [],
  };
}

describe("computeFoodSafetyNudges — fires during nadir", () => {
  it("emits a feed item when phase is nadir", () => {
    const items = computeFoodSafetyNudges({
      cycleContext: ctx("nadir"),
      todayISO: "2026-04-19",
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].category).toBe("nutrition");
    expect(items[0].id).toMatch(/food_safety_nadir/);
  });

  it("emits a feed item during recovery_early (immune system still suppressed)", () => {
    const items = computeFoodSafetyNudges({
      cycleContext: ctx("recovery_early"),
      todayISO: "2026-04-19",
    });
    expect(items.length).toBeGreaterThan(0);
  });

  it("does NOT fire outside nadir/recovery_early", () => {
    const rest = computeFoodSafetyNudges({
      cycleContext: ctx("rest"),
      todayISO: "2026-04-19",
    });
    const none = computeFoodSafetyNudges({
      cycleContext: ctx(null),
      todayISO: "2026-04-19",
    });
    expect(rest).toEqual([]);
    expect(none).toEqual([]);
  });

  it("does NOT fire when cycleContext is null", () => {
    const items = computeFoodSafetyNudges({
      cycleContext: null,
      todayISO: "2026-04-19",
    });
    expect(items).toEqual([]);
  });
});

describe("computeFoodSafetyNudges — content + citations", () => {
  it("links to the diet guide", () => {
    const [item] = computeFoodSafetyNudges({
      cycleContext: ctx("nadir"),
      todayISO: "2026-04-19",
    });
    expect(item.cta?.href).toMatch(/\/nutrition\/guide/);
  });

  it("is caution-toned during nadir", () => {
    const [item] = computeFoodSafetyNudges({
      cycleContext: ctx("nadir"),
      todayISO: "2026-04-19",
    });
    expect(item.tone === "caution" || item.tone === "warning").toBe(true);
  });

  it("exposes the avoid list with the JPCC items", () => {
    const text = JSON.stringify(FOOD_SAFETY_AVOID).toLowerCase();
    expect(text).toMatch(/raw eggs?/);
    expect(text).toMatch(/unpasteur/);
    expect(text).toMatch(/soft chees/);
    expect(text).toMatch(/undercooked meat/);
    expect(text).toMatch(/fermented/);
  });
});
