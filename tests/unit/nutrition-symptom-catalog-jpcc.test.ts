import { describe, it, expect } from "vitest";
import {
  SYMPTOM_CATALOG,
  symptomById,
} from "~/lib/daily/symptom-catalog";

// Stage E: surface the JPCC-aligned daily-form additions through the
// symptom catalog so the daily-wizard renders them automatically.

describe("symptom catalog — JPCC additions", () => {
  it("includes dry_mouth (boolean)", () => {
    const s = symptomById("dry_mouth");
    expect(s).toBeDefined();
    expect(s!.scale).toBe("boolean");
    expect(s!.dailyEntryField).toBe("dry_mouth");
  });

  it("includes early_satiety (boolean)", () => {
    const s = symptomById("early_satiety");
    expect(s).toBeDefined();
    expect(s!.scale).toBe("boolean");
    expect(s!.dailyEntryField).toBe("early_satiety");
  });

  it("dry_mouth and early_satiety are tagged pdac/chemo", () => {
    const dm = symptomById("dry_mouth");
    const es = symptomById("early_satiety");
    expect(dm!.tags).toEqual(expect.arrayContaining(["chemo"]));
    expect(es!.tags).toEqual(expect.arrayContaining(["pdac"]));
  });

  it("catalog ids are still unique after additions", () => {
    const ids = SYMPTOM_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
