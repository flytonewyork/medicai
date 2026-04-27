import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { ensureFoodsSeeded } from "~/lib/nutrition/queries";
import { SEED_FOODS } from "~/lib/nutrition/seed-foods";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const AU_SUPPLEMENT_NAMES = [
  "Sustagen Active",
  "Sustagen Diabetic",
  "Sustagen Neutral",
  "Ensure",
  "Fortisip",
  "Fortisip Compact Protein",
  "Resource Plus",
  "Resource 2.0",
  "AdVital",
  "Beneprotein",
  "Fortijuice",
] as const;

describe("Australian supplement catalogue (JPCC p. 24)", () => {
  it("includes every product the JPCC guide names", () => {
    const seedNames = SEED_FOODS.map((f) =>
      f.name.toLowerCase().replace(/®/g, "").trim(),
    );
    for (const target of AU_SUPPLEMENT_NAMES) {
      const t = target.toLowerCase().trim();
      const found = seedNames.some(
        (n) => n === t || n.startsWith(`${t} `) || n.includes(t),
      );
      expect(
        found,
        `Expected supplement "${target}" missing from SEED_FOODS`,
      ).toBe(true);
    }
  });

  it("each supplement is in the supplement category and has macros", () => {
    const supps = SEED_FOODS.filter((f) =>
      AU_SUPPLEMENT_NAMES.some((name) =>
        f.name.toLowerCase().includes(name.toLowerCase()),
      ),
    );
    expect(supps.length).toBeGreaterThanOrEqual(AU_SUPPLEMENT_NAMES.length);
    for (const s of supps) {
      expect(s.category).toBe("supplement");
      expect(s.calories).toBeGreaterThan(0);
      expect(s.protein_g).toBeGreaterThanOrEqual(0);
      expect(s.fat_g).toBeGreaterThanOrEqual(0);
      expect(s.tags).toEqual(expect.arrayContaining([expect.any(String)]));
    }
  });

  it("seeds successfully into Dexie without throwing", async () => {
    await ensureFoodsSeeded();
    const all = await db.foods.toArray();
    expect(all.length).toBeGreaterThan(0);
    const supps = all.filter((f) => f.category === "supplement");
    expect(supps.length).toBeGreaterThanOrEqual(AU_SUPPLEMENT_NAMES.length);
  });

  it("Sustagen Active has roughly the macros from the manufacturer datasheet", () => {
    const sa = SEED_FOODS.find((f) =>
      f.name.toLowerCase().startsWith("sustagen active"),
    );
    expect(sa).toBeDefined();
    // Per 100 g powder, datasheet ranges: protein ~ 18-25 g, energy ~ 350-400 kcal.
    expect(sa!.protein_g).toBeGreaterThan(15);
    expect(sa!.protein_g).toBeLessThan(30);
    expect(sa!.calories).toBeGreaterThan(300);
    expect(sa!.calories).toBeLessThan(420);
  });

  it("Beneprotein is mostly protein (whey protein isolate)", () => {
    const bp = SEED_FOODS.find((f) =>
      f.name.toLowerCase().startsWith("beneprotein"),
    );
    expect(bp).toBeDefined();
    expect(bp!.protein_g).toBeGreaterThan(75); // ~86g per 100g
    expect(bp!.fat_g).toBeLessThan(2);
    expect(bp!.carbs_total_g).toBeLessThan(5);
  });
});
