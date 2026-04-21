import { describe, it, expect } from "vitest";
import {
  buildCycleContext,
  currentPhase,
  cycleDayFor,
  daysUntilNadir,
  daysUntilNextDose,
} from "~/lib/treatment/engine";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import type { TreatmentCycle } from "~/types/treatment";

const gnp = PROTOCOL_BY_ID.gnp_weekly!;

function cycle(overrides: Partial<TreatmentCycle> = {}): TreatmentCycle {
  return {
    protocol_id: "gnp_weekly",
    cycle_number: 1,
    start_date: "2026-04-01",
    status: "active",
    dose_level: 0,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("cycleDayFor", () => {
  it("returns 1 on start date", () => {
    expect(cycleDayFor("2026-04-01", new Date("2026-04-01"))).toBe(1);
  });
  it("returns 15 two weeks later", () => {
    expect(cycleDayFor("2026-04-01", new Date("2026-04-15"))).toBe(15);
  });
});

describe("currentPhase", () => {
  it("identifies dose day 1", () => {
    const p = currentPhase(gnp, 1);
    expect(p?.key).toBe("dose_day");
  });
  it("identifies nadir in D16-D21", () => {
    const p = currentPhase(gnp, 18);
    expect(p?.key).toBe("nadir");
  });
  it("identifies recovery in D24", () => {
    const p = currentPhase(gnp, 24);
    expect(p?.key).toBe("recovery_late");
  });
});

describe("daysUntilNextDose", () => {
  it("D1 → next is D8 in 7 days", () => {
    expect(daysUntilNextDose(gnp, 1)).toBe(7);
  });
  it("D20 → no next dose", () => {
    expect(daysUntilNextDose(gnp, 20)).toBe(null);
  });
});

describe("daysUntilNadir", () => {
  it("D1 → 15 days until nadir start", () => {
    expect(daysUntilNadir(gnp, 1)).toBe(15);
  });
  it("D18 → 0 (in nadir)", () => {
    expect(daysUntilNadir(gnp, 18)).toBe(0);
  });
  it("D23 → null (past nadir)", () => {
    expect(daysUntilNadir(gnp, 23)).toBe(null);
  });
});

describe("buildCycleContext", () => {
  it("day 1 returns dose_day context with dose-day nudges", () => {
    const ctx = buildCycleContext(cycle(), new Date("2026-04-01"));
    expect(ctx).toBeTruthy();
    expect(ctx!.cycle_day).toBe(1);
    expect(ctx!.is_dose_day).toBe(true);
    expect(ctx!.applicable_nudges.length).toBeGreaterThan(0);
    const ids = ctx!.applicable_nudges.map((n) => n.id);
    expect(ids).toContain("gnp_dose_day_cold_warning");
    expect(ids).toContain("gnp_dose_day_hydration");
  });

  it("day 18 (nadir) surfaces hygiene + temp warnings", () => {
    const ctx = buildCycleContext(cycle(), new Date("2026-04-18"));
    const ids = ctx!.applicable_nudges.map((n) => n.id);
    expect(ids).toContain("gnp_nadir_hygiene");
    expect(ids).toContain("gnp_nadir_temp");
    expect(ids).toContain("gnp_nadir_crowds");
  });

  it("sorts warnings before cautions before info", () => {
    const ctx = buildCycleContext(cycle(), new Date("2026-04-18"));
    const severities = ctx!.applicable_nudges.map((n) => n.severity);
    const firstInfo = severities.indexOf("info");
    const lastWarning = severities.lastIndexOf("warning");
    if (firstInfo >= 0 && lastWarning >= 0) {
      expect(lastWarning).toBeLessThan(firstInfo);
    }
  });

  it("respects snoozed nudges", () => {
    const ctx = buildCycleContext(
      cycle({ snoozed_nudge_ids: ["gnp_nadir_hygiene"] }),
      new Date("2026-04-18"),
    );
    const ids = ctx!.applicable_nudges.map((n) => n.id);
    expect(ids).not.toContain("gnp_nadir_hygiene");
  });

  it("identifies recovery window on D24", () => {
    const ctx = buildCycleContext(cycle(), new Date("2026-04-24"));
    expect(ctx!.phase?.key).toBe("recovery_late");
    const ids = ctx!.applicable_nudges.map((n) => n.id);
    expect(ids).toContain("gnp_recovery_activity");
  });

  it("returns null for unknown protocol", () => {
    const ctx = buildCycleContext(
      cycle({ protocol_id: "custom" as "custom" }),
      new Date("2026-04-01"),
    );
    expect(ctx).toBe(null);
  });
});
