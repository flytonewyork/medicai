import { describe, it, expect } from "vitest";
import { defaultTargets } from "~/lib/nutrition/calculator";

describe("defaultTargets — backwards compatible", () => {
  it("returns the original low-carb defaults when no mode is passed", () => {
    const t = defaultTargets(70);
    expect(t.protein_g).toBe(84); // 1.2 g/kg
    expect(t.calories_kcal).toBe(2100); // 30 kcal/kg
    expect(t.net_carbs_g_max).toBe(50);
    expect(t.fluids_ml).toBe(2000);
  });

  it("falls back to sensible defaults when weight is missing", () => {
    const t = defaultTargets();
    expect(t.protein_g).toBeGreaterThan(0);
    expect(t.net_carbs_g_max).toBe(50);
  });
});

describe("defaultTargets — energy_dense mode", () => {
  it("raises calorie target by ~17% (35 vs 30 kcal/kg)", () => {
    const lc = defaultTargets(80, "low_carb");
    const ed = defaultTargets(80, "energy_dense");
    expect(ed.calories_kcal!).toBeGreaterThan(lc.calories_kcal!);
    expect(ed.calories_kcal!).toBe(2800); // 80 * 35
  });

  it("relaxes the net-carb cap (JPCC explicitly recommends energy density via carbs)", () => {
    const lc = defaultTargets(80, "low_carb");
    const ed = defaultTargets(80, "energy_dense");
    expect(ed.net_carbs_g_max).toBeGreaterThan(lc.net_carbs_g_max);
  });

  it("keeps protein target proportional to weight (JPCC supports high protein)", () => {
    const t = defaultTargets(80, "energy_dense");
    expect(t.protein_g).toBeGreaterThanOrEqual(96); // at least 1.2 g/kg
  });
});

describe("defaultTargets — transitional mode", () => {
  it("treats transitional like low_carb to avoid premature liberalisation", () => {
    const lc = defaultTargets(80, "low_carb");
    const tr = defaultTargets(80, "transitional");
    expect(tr.net_carbs_g_max).toBe(lc.net_carbs_g_max);
  });
});
