import { describe, expect, it } from "vitest";
import { buildCoachSystem, buildSummarySystem } from "~/lib/ai/coach";
import { buildNutritionSystem } from "~/lib/nutrition/parser-schema";
import { buildIngestSystem } from "~/lib/ingest/draft-schema";
import { buildMealSystem } from "~/lib/ingest/meal-vision";
import { buildNotesSystem } from "~/lib/ingest/notes-vision";
import { buildNarrativeSystem } from "~/lib/nudges/ai-narrative";
import { renderProfileTemplate } from "~/lib/household/profile";
import type { HouseholdProfile } from "~/types/household-profile";

// Phase 1.2 acceptance: AI system prompts must template patient
// identity from the per-household profile, not bake it in as literals.

const FAKE_PROFILE: HouseholdProfile = {
  household_id: "abc-123",
  patient_initials: "AB",
  diagnosis_short: "stage IV gallbladder cancer",
  diagnosis_full:
    "stage IV gallbladder cancer on first-line gemcitabine + cisplatin",
  oncologist_name: "Dr Generic",
  surgeon_name: "Dr Surgical",
  locale_default: "en",
  created_at: "2026-04-26T00:00:00Z",
  updated_at: "2026-04-26T00:00:00Z",
};

const FORBIDDEN = ["Hu Lin", "Sumitra", "Cullinan", "metastatic PDAC"];

function assertClean(prompt: string) {
  for (const literal of FORBIDDEN) {
    expect(prompt).not.toContain(literal);
  }
}

describe("AI system prompts template patient identity", () => {
  it("coach system contains values from the fake profile", () => {
    const prompt = buildCoachSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    expect(prompt).toContain("Dr Generic");
    assertClean(prompt);
  });

  it("summary system contains values from the fake profile", () => {
    const prompt = buildSummarySystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    expect(prompt).toContain("Dr Generic");
    assertClean(prompt);
  });

  it("nutrition system contains values from the fake profile", () => {
    const prompt = buildNutritionSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    assertClean(prompt);
  });

  it("ingest system contains values from the fake profile", () => {
    const prompt = buildIngestSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    assertClean(prompt);
  });

  it("meal-vision system contains values from the fake profile", () => {
    const prompt = buildMealSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    assertClean(prompt);
  });

  it("notes-vision system contains values from the fake profile", () => {
    const prompt = buildNotesSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    assertClean(prompt);
  });

  it("narrative system contains values from the fake profile", () => {
    const prompt = buildNarrativeSystem(FAKE_PROFILE);
    expect(prompt).toContain("AB");
    expect(prompt).toContain("stage IV gallbladder cancer");
    assertClean(prompt);
  });
});

describe("renderProfileTemplate", () => {
  it("interpolates {patient_initials} and {diagnosis_short}", () => {
    const out = renderProfileTemplate(
      "{patient_initials} ({diagnosis_short})",
      FAKE_PROFILE,
    );
    expect(out).toBe("AB (stage IV gallbladder cancer)");
  });

  it("falls back to a generic phrase when oncologist is null", () => {
    const profile: HouseholdProfile = { ...FAKE_PROFILE, oncologist_name: null };
    const out = renderProfileTemplate("Defer to {oncologist_name}.", profile);
    expect(out).toBe("Defer to the patient's oncologist.");
  });
});
