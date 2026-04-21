import { describe, it, expect } from "vitest";
import {
  isCustomPractice,
  practiceSlug,
  scheduleSummary,
} from "~/lib/medication/practices";
import type { DoseSchedule, Medication } from "~/types/medication";

function med(overrides: Partial<Medication> = {}): Medication {
  return {
    drug_id: "custom:morning_breathing",
    display_name: "Morning breathing",
    category: "behavioural",
    dose: "10 min",
    route: "practice",
    schedule: { kind: "fixed", times_per_day: 1 },
    source: "user_added",
    active: true,
    started_on: "2026-04-01",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("practiceSlug", () => {
  it("produces a url-safe, custom-namespaced slug", () => {
    expect(practiceSlug("Morning Breathing")).toBe("custom:morning_breathing");
    expect(practiceSlug("Qigong — 15 min")).toBe("custom:qigong_15_min");
  });

  it("falls back to 'practice' on empty input", () => {
    expect(practiceSlug("   ")).toBe("custom:practice");
    expect(practiceSlug("")).toBe("custom:practice");
  });

  it("truncates overly long names", () => {
    const slug = practiceSlug("a".repeat(80));
    expect(slug.length).toBeLessThanOrEqual("custom:".length + 40);
  });
});

describe("isCustomPractice", () => {
  it("returns true for drug_ids prefixed with custom:", () => {
    expect(isCustomPractice(med({ drug_id: "custom:walk" }))).toBe(true);
  });
  it("returns false for catalogue drugs like qigong", () => {
    expect(isCustomPractice(med({ drug_id: "qigong" }))).toBe(false);
    expect(isCustomPractice(med({ drug_id: "resistance_training" }))).toBe(
      false,
    );
  });
});

describe("scheduleSummary", () => {
  it("prefers the schedule's localised label when present", () => {
    const s: DoseSchedule = {
      kind: "fixed",
      label: { en: "Once daily at 07:00", zh: "每日 07:00 一次" },
    };
    expect(scheduleSummary(s, "en")).toBe("Once daily at 07:00");
    expect(scheduleSummary(s, "zh")).toBe("每日 07:00 一次");
  });

  it("falls back to the kind when no label", () => {
    expect(scheduleSummary({ kind: "prn" }, "en")).toBe("prn");
  });
});
