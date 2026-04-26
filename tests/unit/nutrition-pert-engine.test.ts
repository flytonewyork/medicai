import { describe, it, expect } from "vitest";
import {
  evaluatePert,
  PERT_NO_DOSE_TAGS,
} from "~/lib/nutrition/pert-engine";

describe("evaluatePert — JPCC no-PERT list", () => {
  it.each([
    "fruit",
    "jelly",
    "soft_drink",
    "juice",
    "water",
    "black_tea",
    "black_coffee",
  ])("skips PERT when only %s is consumed", (tag) => {
    const out = evaluatePert({
      items: [{ food_name: tag, protein_g: 0, fat_g: 0, tags: [tag] }],
    });
    expect(out.required).toBe(false);
    expect(out.recommendation).toBe("skip");
  });

  it("exposes the canonical no-PERT tag list for UI consumers", () => {
    expect(PERT_NO_DOSE_TAGS).toEqual(
      expect.arrayContaining([
        "fruit",
        "jelly",
        "soft_drink",
        "juice",
        "water",
        "black_tea",
        "black_coffee",
      ]),
    );
  });
});

describe("evaluatePert — required when protein or fat is present", () => {
  it("requires PERT when any item has protein", () => {
    const out = evaluatePert({
      items: [{ food_name: "Yoghurt", protein_g: 8, fat_g: 0 }],
    });
    expect(out.required).toBe(true);
    expect(out.recommendation).toBe("standard");
  });

  it("requires PERT when any item has fat", () => {
    const out = evaluatePert({
      items: [{ food_name: "Avocado", protein_g: 0, fat_g: 15 }],
    });
    expect(out.required).toBe(true);
    expect(out.recommendation).toBe("standard");
  });

  it("returns half dose for snacks", () => {
    const out = evaluatePert({
      items: [{ food_name: "Cheese cube", protein_g: 6, fat_g: 9 }],
      meal_type: "snack",
    });
    expect(out.required).toBe(true);
    expect(out.recommendation).toBe("half");
  });

  it("returns split dose when meal duration > 30 min (overrides snack/half)", () => {
    const out = evaluatePert({
      items: [{ food_name: "Roast dinner", protein_g: 30, fat_g: 25 }],
      meal_type: "dinner",
      duration_min: 45,
    });
    expect(out.recommendation).toBe("split");
  });

  it("split takes priority over half even if it's a long snack", () => {
    const out = evaluatePert({
      items: [{ food_name: "Slow grazing plate", protein_g: 10, fat_g: 12 }],
      meal_type: "snack",
      duration_min: 60,
    });
    expect(out.recommendation).toBe("split");
  });
});

describe("evaluatePert — citations", () => {
  it("attaches a JPCC citation to every evaluation (even skip)", () => {
    const skip = evaluatePert({
      items: [{ food_name: "Apple", tags: ["fruit"] }],
    });
    const std = evaluatePert({
      items: [{ food_name: "Eggs", protein_g: 12, fat_g: 10 }],
    });
    expect(skip.citations.some((c) => c.source_id === "jpcc_2021")).toBe(true);
    expect(std.citations.some((c) => c.source_id === "jpcc_2021")).toBe(true);
    expect(skip.citations.find((c) => c.source_id === "jpcc_2021")?.page).toBe(19);
  });

  it("provides bilingual reason text", () => {
    const out = evaluatePert({
      items: [{ food_name: "Salmon", protein_g: 20, fat_g: 12 }],
    });
    expect(out.reason.en).toBeTruthy();
    expect(out.reason.zh).toBeTruthy();
  });
});
