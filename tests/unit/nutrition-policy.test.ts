import { describe, it, expect } from "vitest";
import { evaluateNutritionPolicy } from "~/lib/nutrition/policy";
import type { DailyEntry, Settings } from "~/types/clinical";

const baseSettings: Settings = {
  id: 1,
  profile_name: "Test",
  locale: "en",
  baseline_weight_kg: 80,
  baseline_date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function d(overrides: Partial<DailyEntry>): DailyEntry {
  return {
    date: "2026-04-20",
    entered_at: "2026-04-20T09:00:00Z",
    entered_by: "hulin",
    created_at: "2026-04-20T09:00:00Z",
    updated_at: "2026-04-20T09:00:00Z",
    ...overrides,
  };
}

// 30 chronological days ending at todayISO with steady weight + appetite.
function steadyDailies(opts: {
  startDate?: string;
  weight: number;
  appetite: number;
  days?: number;
}): DailyEntry[] {
  const days = opts.days ?? 30;
  const start = new Date(opts.startDate ?? "2026-03-21");
  const out: DailyEntry[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    out.push(
      d({
        date: iso,
        entered_at: `${iso}T09:00:00Z`,
        weight_kg: opts.weight,
        appetite: opts.appetite,
      }),
    );
  }
  return out;
}

describe("evaluateNutritionPolicy — defaults", () => {
  it("returns low_carb when no data is available (matches CLAUDE.md baseline)", () => {
    const out = evaluateNutritionPolicy({
      settings: null,
      recentDailies: [],
      todayISO: "2026-04-20",
    });
    expect(out.mode).toBe("low_carb");
    expect(out.triggers.length).toBeGreaterThan(0);
    expect(out.triggers[0].kind).toBe("default");
  });

  it("stays low_carb when weight stable within 2% and appetite >= 6", () => {
    const out = evaluateNutritionPolicy({
      settings: baseSettings,
      recentDailies: steadyDailies({ weight: 80, appetite: 7 }),
      todayISO: "2026-04-19",
    });
    expect(out.mode).toBe("low_carb");
    expect(out.triggers.some((t) => t.kind === "stable")).toBe(true);
  });
});

describe("evaluateNutritionPolicy — energy_dense triggers", () => {
  it("flips to energy_dense on >=5% weight loss vs baseline", () => {
    const dailies = steadyDailies({ weight: 75, appetite: 7 }); // 6.25% loss from 80kg
    const out = evaluateNutritionPolicy({
      settings: baseSettings,
      recentDailies: dailies,
      todayISO: "2026-04-19",
    });
    expect(out.mode).toBe("energy_dense");
    expect(out.triggers.some((t) => t.kind === "weight_loss")).toBe(true);
  });

  it("flips to energy_dense when 7-day mean appetite <= 4", () => {
    const dailies = steadyDailies({ weight: 80, appetite: 3 });
    const out = evaluateNutritionPolicy({
      settings: baseSettings,
      recentDailies: dailies,
      todayISO: "2026-04-19",
    });
    expect(out.mode).toBe("energy_dense");
    expect(out.triggers.some((t) => t.kind === "appetite_low")).toBe(true);
  });

  it("does not flip on a single day of low appetite", () => {
    const seven = steadyDailies({ weight: 80, appetite: 7 });
    seven[seven.length - 1] = { ...seven[seven.length - 1], appetite: 2 };
    const out = evaluateNutritionPolicy({
      settings: baseSettings,
      recentDailies: seven,
      todayISO: "2026-04-19",
    });
    expect(out.mode).not.toBe("energy_dense");
  });
});

describe("evaluateNutritionPolicy — citations", () => {
  it("attaches JPCC citation to weight-loss trigger", () => {
    const out = evaluateNutritionPolicy({
      settings: baseSettings,
      recentDailies: steadyDailies({ weight: 73, appetite: 5 }),
      todayISO: "2026-04-19",
    });
    const wl = out.triggers.find((t) => t.kind === "weight_loss");
    expect(wl).toBeDefined();
    expect(wl!.citations.some((c) => c.source_id === "jpcc_2021")).toBe(true);
  });

  it("provides bilingual rationale", () => {
    const out = evaluateNutritionPolicy({
      settings: null,
      recentDailies: [],
      todayISO: "2026-04-19",
    });
    expect(out.rationale.en).toBeTruthy();
    expect(out.rationale.zh).toBeTruthy();
  });
});
