import { describe, it, expect } from "vitest";
import {
  SYMPTOM_CATALOG,
  symptomById,
  defaultTrackedSymptomIds,
  isInChemoWindow,
  rankTrackedSymptoms,
} from "~/lib/daily/symptom-catalog";

describe("SYMPTOM_CATALOG", () => {
  it("has unique ids", () => {
    const ids = SYMPTOM_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes a PDAC/GnP-leaning default set of ~10 items", () => {
    const defaults = defaultTrackedSymptomIds();
    expect(defaults.length).toBeGreaterThanOrEqual(8);
    expect(defaults.length).toBeLessThanOrEqual(12);
  });

  it("defaults include the GnP neuropathy axes", () => {
    const defaults = new Set(defaultTrackedSymptomIds());
    expect(defaults.has("neuropathy_hands")).toBe(true);
    expect(defaults.has("neuropathy_feet")).toBe(true);
  });

  it("defaults include PDAC-specific complaints (abdominal pain, anorexia)", () => {
    const defaults = new Set(defaultTrackedSymptomIds());
    expect(defaults.has("abdominal_pain")).toBe(true);
    expect(defaults.has("anorexia")).toBe(true);
  });

  it("fever is flagged as a safety sentinel", () => {
    const f = symptomById("fever");
    expect(f?.tags).toContain("safety");
  });

  it("steatorrhoea is flagged as a PERT sentinel", () => {
    const s = symptomById("steatorrhoea");
    expect(s?.tags).toContain("pert");
  });
});

describe("isInChemoWindow", () => {
  const now = new Date("2026-04-22T12:00:00.000Z");

  it("returns true when chemo is within ±3 days by default", () => {
    expect(isInChemoWindow("2026-04-24T09:00:00.000Z", now)).toBe(true);
    expect(isInChemoWindow("2026-04-20T09:00:00.000Z", now)).toBe(true);
  });

  it("returns false when chemo is outside the window", () => {
    expect(isInChemoWindow("2026-04-27T09:00:00.000Z", now)).toBe(false);
    expect(isInChemoWindow("2026-04-17T09:00:00.000Z", now)).toBe(false);
  });

  it("returns false for null or invalid timestamps", () => {
    expect(isInChemoWindow(null, now)).toBe(false);
    expect(isInChemoWindow("not-a-date", now)).toBe(false);
  });

  it("respects a custom window size", () => {
    expect(isInChemoWindow("2026-04-26T09:00:00.000Z", now, 5)).toBe(true);
    expect(isInChemoWindow("2026-04-26T09:00:00.000Z", now, 2)).toBe(false);
  });
});

describe("rankTrackedSymptoms", () => {
  const all = SYMPTOM_CATALOG.map((s) => s.id);

  it("preserves catalog order when not in chemo window", () => {
    const rows = rankTrackedSymptoms(all, { inChemoWindow: false });
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual(SYMPTOM_CATALOG.map((s) => s.id));
  });

  it("floats gnp/chemo items to the top in chemo window", () => {
    const rows = rankTrackedSymptoms(all, { inChemoWindow: true });
    const firstPdacOnly = rows.findIndex(
      (r) =>
        !r.tags.includes("gnp") &&
        !r.tags.includes("chemo"),
    );
    const lastChemoLike = [...rows]
      .reverse()
      .findIndex((r) => r.tags.includes("gnp") || r.tags.includes("chemo"));
    const lastIdx = rows.length - 1 - lastChemoLike;
    expect(lastIdx).toBeLessThan(firstPdacOnly);
  });

  it("filters to only the ids passed in", () => {
    const rows = rankTrackedSymptoms(["fatigue", "fever"], {
      inChemoWindow: false,
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["fatigue", "fever"]);
  });
});
