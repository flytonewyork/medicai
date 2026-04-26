import { describe, it, expect } from "vitest";
import {
  scalePreviewItemToGrams,
  type PreviewItem,
} from "~/components/nutrition/parsed-preview";

const base: PreviewItem = {
  name: "Chicken thigh",
  serving_grams: 100,
  calories: 247,
  protein_g: 25.9,
  fat_g: 15.5,
  carbs_total_g: 0,
  fiber_g: 0,
};

describe("scalePreviewItemToGrams", () => {
  it("doubles every macro when grams double", () => {
    const next = scalePreviewItemToGrams(base, 200);
    expect(next.serving_grams).toBe(200);
    expect(next.protein_g).toBeCloseTo(51.8, 1);
    expect(next.fat_g).toBeCloseTo(31.0, 1);
    expect(next.calories).toBe(494);
  });

  it("halves macros when grams halve", () => {
    const next = scalePreviewItemToGrams(base, 50);
    expect(next.serving_grams).toBe(50);
    expect(next.protein_g).toBeCloseTo(13.0, 1);
    expect(next.fat_g).toBeCloseTo(7.8, 1);
    expect(next.calories).toBe(124);
  });

  it("scales fibre and total carbs proportionally", () => {
    const veg: PreviewItem = {
      ...base,
      name: "Broccoli",
      serving_grams: 80,
      calories: 28,
      protein_g: 2.2,
      fat_g: 0.3,
      carbs_total_g: 5.6,
      fiber_g: 2.1,
    };
    const next = scalePreviewItemToGrams(veg, 160);
    expect(next.carbs_total_g).toBeCloseTo(11.2, 1);
    expect(next.fiber_g).toBeCloseTo(4.2, 1);
  });

  it("zeroes macros when grams set to 0", () => {
    const next = scalePreviewItemToGrams(base, 0);
    expect(next.serving_grams).toBe(0);
    expect(next.protein_g).toBe(0);
    expect(next.fat_g).toBe(0);
    expect(next.calories).toBe(0);
  });

  it("rounds non-integer grams to a whole number", () => {
    const next = scalePreviewItemToGrams(base, 149.6);
    expect(next.serving_grams).toBe(150);
  });

  it("clamps negative grams to 0", () => {
    const next = scalePreviewItemToGrams(base, -25);
    expect(next.serving_grams).toBe(0);
    expect(next.protein_g).toBe(0);
  });

  it("returns the same reference when grams are unchanged", () => {
    const next = scalePreviewItemToGrams(base, 100);
    expect(next).toBe(base);
  });

  it("sets grams without scaling when starting weight is 0", () => {
    const orphan: PreviewItem = { ...base, serving_grams: 0 };
    const next = scalePreviewItemToGrams(orphan, 100);
    expect(next.serving_grams).toBe(100);
    expect(next.protein_g).toBe(base.protein_g);
  });

  it("preserves identity fields (name, food_id, notes)", () => {
    const tagged: PreviewItem = {
      ...base,
      name_zh: "鸡腿",
      food_id: 42,
      notes: "skin off",
    };
    const next = scalePreviewItemToGrams(tagged, 150);
    expect(next.name).toBe(tagged.name);
    expect(next.name_zh).toBe(tagged.name_zh);
    expect(next.food_id).toBe(42);
    expect(next.notes).toBe("skin off");
  });
});
