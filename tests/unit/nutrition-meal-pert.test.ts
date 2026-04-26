import { describe, it, expect } from "vitest";
import { evaluateMealPert } from "~/lib/nutrition/pert-engine";

// Convenience evaluator for the meal-list / dashboard UIs that only
// have a `MealEntry` snapshot to work with (totals + meal_type +
// pert_taken). Wraps `evaluatePert` with a single synthetic item.

describe("evaluateMealPert — from meal totals", () => {
  it("required when total fat > 0", () => {
    const out = evaluateMealPert({
      total_protein_g: 0,
      total_fat_g: 8,
      meal_type: "snack",
    });
    expect(out.required).toBe(true);
  });

  it("required when total protein > 0", () => {
    const out = evaluateMealPert({
      total_protein_g: 12,
      total_fat_g: 0,
      meal_type: "lunch",
    });
    expect(out.required).toBe(true);
  });

  it("not required when both protein and fat are zero", () => {
    const out = evaluateMealPert({
      total_protein_g: 0,
      total_fat_g: 0,
      meal_type: "snack",
    });
    // Snack with no protein/fat → can be a fruit / juice / water snack.
    // JPCC rule: no PERT needed.
    expect(out.required).toBe(false);
  });

  it("returns half-dose for snacks with protein/fat", () => {
    const out = evaluateMealPert({
      total_protein_g: 6,
      total_fat_g: 9,
      meal_type: "snack",
    });
    expect(out.recommendation).toBe("half");
  });

  it("returns standard for main meals", () => {
    const out = evaluateMealPert({
      total_protein_g: 25,
      total_fat_g: 18,
      meal_type: "dinner",
    });
    expect(out.recommendation).toBe("standard");
  });
});
