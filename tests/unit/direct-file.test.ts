import { describe, it, expect } from "vitest";
import { parseDirectFile } from "~/lib/log/direct-file";

const TODAY = "2026-05-06";

describe("parseDirectFile", () => {
  it("files a blood-glucose reading with a time-of-day hint", () => {
    const r = parseDirectFile("blood sugar this morning 7.9", TODAY);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("lab");
    if (r!.kind === "lab") {
      expect(r!.patch.glucose).toBe(7.9);
      expect(r!.patch.date).toBe(TODAY);
      expect(r!.patch.source).toBe("patient_self_report");
      expect(r!.summary.en.toLowerCase()).toContain("blood glucose");
      expect(r!.summary.en).toContain("7.9");
      expect(r!.summary.en).toContain("morning");
    }
  });

  it("recognises bsl / bgl abbreviations with a unit", () => {
    const r = parseDirectFile("BGL 5.3 mmol/L", TODAY);
    expect(r).not.toBeNull();
    if (r?.kind === "lab") {
      expect(r.patch.glucose).toBe(5.3);
    }
  });

  it("files weight in kg as a daily_entries patch", () => {
    const r = parseDirectFile("weight 64.5 kg", TODAY);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("daily");
    if (r!.kind === "daily") {
      expect(r!.patch.weight_kg).toBe(64.5);
    }
  });

  it("files temperature and flags fever above 38", () => {
    const low = parseDirectFile("temp 37.2", TODAY);
    expect(low?.kind).toBe("daily");
    if (low?.kind === "daily") {
      expect(low.patch.fever_temp).toBe(37.2);
      expect(low.patch.fever).toBe(false);
    }
    const high = parseDirectFile("temperature 38.4", TODAY);
    if (high?.kind === "daily") {
      expect(high.patch.fever_temp).toBe(38.4);
      expect(high.patch.fever).toBe(true);
    }
  });

  it("rejects implausible temperature values", () => {
    expect(parseDirectFile("temp 45.0", TODAY)).toBeNull();
    expect(parseDirectFile("temp 10.0", TODAY)).toBeNull();
  });

  it("extracts walking minutes either phrasing", () => {
    const a = parseDirectFile("walked 22 min", TODAY);
    expect(a?.kind).toBe("daily");
    if (a?.kind === "daily") expect(a.patch.walking_minutes).toBe(22);

    const b = parseDirectFile("30 min walk in the park", TODAY);
    if (b?.kind === "daily") expect(b.patch.walking_minutes).toBe(30);
  });

  it("extracts step count", () => {
    const r = parseDirectFile("4200 steps today", TODAY);
    expect(r?.kind).toBe("daily");
    if (r?.kind === "daily") expect(r.patch.steps).toBe(4200);
  });

  it("extracts protein grams", () => {
    const r = parseDirectFile("had 40 g protein at lunch", TODAY);
    expect(r?.kind).toBe("daily");
    if (r?.kind === "daily") expect(r.patch.protein_grams).toBe(40);
  });

  it("returns null for narrative / multi-topic text", () => {
    expect(
      parseDirectFile(
        "had a rough morning with some nausea and the neuropathy is worse on the right fingertips",
        TODAY,
      ),
    ).toBeNull();
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(parseDirectFile("", TODAY)).toBeNull();
    expect(parseDirectFile("   ", TODAY)).toBeNull();
  });

  it("returns null for pure numbers (no keyword)", () => {
    // Too ambiguous: 7.9 could be glucose, weight, temperature, anything.
    expect(parseDirectFile("7.9", TODAY)).toBeNull();
  });

  it("caps at 160 characters so long notes fall through to agents", () => {
    const long = "blood sugar 7.9 " + "x".repeat(200);
    expect(parseDirectFile(long, TODAY)).toBeNull();
  });
});
