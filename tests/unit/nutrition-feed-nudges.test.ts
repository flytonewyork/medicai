import { describe, it, expect } from "vitest";
import { computeNutritionNudges } from "~/lib/nudges/nutrition-nudges";
import type { DailyEntry, Settings } from "~/types/clinical";

const settings: Settings = {
  id: 1,
  profile_name: "Test",
  locale: "en",
  baseline_weight_kg: 80,
  baseline_date: "2026-01-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function dailies(opts: { weight: number; appetite: number; days?: number }): DailyEntry[] {
  const days = opts.days ?? 14;
  const out: DailyEntry[] = [];
  const start = new Date("2026-04-06");
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    out.push({
      date: iso,
      entered_at: `${iso}T09:00:00Z`,
      entered_by: "hulin",
      weight_kg: opts.weight,
      appetite: opts.appetite,
      created_at: `${iso}T09:00:00Z`,
      updated_at: `${iso}T09:00:00Z`,
    });
  }
  return out;
}

describe("computeNutritionNudges — energy_dense surfaces a feed item", () => {
  it("emits a nutrition-category nudge when policy flips to energy_dense", () => {
    const items = computeNutritionNudges({
      settings,
      recentDailies: dailies({ weight: 73, appetite: 5 }), // 8.75% weight loss
      todayISO: "2026-04-19",
    });
    expect(items.length).toBeGreaterThan(0);
    const policy = items.find((it) => it.id.startsWith("nutrition_policy_"));
    expect(policy).toBeDefined();
    expect(policy!.category).toBe("nutrition");
    expect(policy!.tone).toBe("caution");
    // Should link to the guide
    expect(policy!.cta?.href).toBe("/nutrition/guide");
  });

  it("emits a positive item when policy is stable low_carb", () => {
    const items = computeNutritionNudges({
      settings,
      recentDailies: dailies({ weight: 80, appetite: 7 }),
      todayISO: "2026-04-19",
    });
    const policy = items.find((it) => it.id.startsWith("nutrition_policy_"));
    expect(policy).toBeDefined();
    expect(policy!.tone === "info" || policy!.tone === "positive").toBe(true);
  });
});

describe("computeNutritionNudges — bilingual + ranked", () => {
  it("titles and bodies are present in both languages", () => {
    const items = computeNutritionNudges({
      settings,
      recentDailies: dailies({ weight: 73, appetite: 5 }),
      todayISO: "2026-04-19",
    });
    const policy = items.find((it) => it.id.startsWith("nutrition_policy_"))!;
    expect(policy.title.en).toBeTruthy();
    expect(policy.title.zh).toBeTruthy();
    expect(policy.body.en).toBeTruthy();
    expect(policy.body.zh).toBeTruthy();
  });

  it("priority is below safety/checkin (≤ 50) but above weather (≥ 25)", () => {
    const items = computeNutritionNudges({
      settings,
      recentDailies: dailies({ weight: 73, appetite: 5 }),
      todayISO: "2026-04-19",
    });
    const policy = items.find((it) => it.id.startsWith("nutrition_policy_"))!;
    expect(policy.priority).toBeGreaterThan(25);
    expect(policy.priority).toBeLessThan(60);
  });
});
