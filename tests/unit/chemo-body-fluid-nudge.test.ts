import { describe, it, expect } from "vitest";
import { computeChemoBodyFluidNudges } from "~/lib/nudges/chemo-body-fluid-nudges";
import type { CycleContext, Protocol, PhaseKey } from "~/types/treatment";

const protocol: Protocol = {
  id: "gnp_weekly",
  name: { en: "GnP weekly", zh: "" },
  short_name: "GnP weekly",
  description: { en: "", zh: "" },
  cycle_length_days: 28,
  agents: [],
  dose_days: [1, 8, 15],
  phase_windows: [],
  side_effect_profile: { en: "", zh: "" },
  typical_supportive: [],
};

function ctx(phaseKey: PhaseKey | null, isDoseDay = false): CycleContext {
  const phase =
    phaseKey === null
      ? null
      : {
          key: phaseKey,
          day_start: 1,
          day_end: 3,
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
    cycle_day: 2,
    phase,
    is_dose_day: isDoseDay,
    days_until_next_dose: null,
    days_until_nadir: null,
    applicable_nudges: [],
  };
}

// eviq guide rule: chemo stays in body fluids for ~48h (some agents up
// to 7d). The nudge surfaces during the dose_day + post_dose phases —
// exactly the 48h-after-treatment window where the patient and family
// need to follow body-fluid precautions.

describe("computeChemoBodyFluidNudges — fires only in body-fluid window", () => {
  it("fires on dose_day", () => {
    const items = computeChemoBodyFluidNudges({
      cycleContext: ctx("dose_day", true),
      todayISO: "2026-04-02",
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toMatch(/chemo_body_fluid/);
    expect(items[0].category).toBe("safety");
  });

  it("fires during post_dose (48h after each dose)", () => {
    const items = computeChemoBodyFluidNudges({
      cycleContext: ctx("post_dose"),
      todayISO: "2026-04-03",
    });
    expect(items.length).toBeGreaterThan(0);
  });

  it("does NOT fire during nadir / recovery / rest / pre_dose", () => {
    for (const k of ["nadir", "recovery_early", "recovery_late", "rest", "pre_dose"] as const) {
      const items = computeChemoBodyFluidNudges({
        cycleContext: ctx(k),
        todayISO: "2026-04-19",
      });
      expect(items, `should be empty for phase=${k}`).toEqual([]);
    }
  });

  it("does NOT fire when cycleContext is null", () => {
    expect(
      computeChemoBodyFluidNudges({
        cycleContext: null,
        todayISO: "2026-04-19",
      }),
    ).toEqual([]);
  });
});

describe("computeChemoBodyFluidNudges — content + linking", () => {
  it("links to the chemo-at-home safety guide", () => {
    const [item] = computeChemoBodyFluidNudges({
      cycleContext: ctx("dose_day", true),
      todayISO: "2026-04-02",
    });
    expect(item.cta?.href).toMatch(/^\/safety\/chemo-at-home/);
  });

  it("is bilingual + caution-toned (clinical reminder, not a hazard)", () => {
    const [item] = computeChemoBodyFluidNudges({
      cycleContext: ctx("post_dose"),
      todayISO: "2026-04-03",
    });
    expect(item.title.en).toBeTruthy();
    expect(item.title.zh).toBeTruthy();
    expect(item.body.en).toBeTruthy();
    expect(item.body.zh).toBeTruthy();
    expect(item.tone).toBe("caution");
  });
});
