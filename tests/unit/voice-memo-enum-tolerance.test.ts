import { describe, it, expect } from "vitest";
import { VoiceMemoParseSchema } from "~/lib/voice-memo/parse-schema";

// Tolerant-enum coverage. Voice-memo parsing runs through
// messages.create + manual JSON.parse + Zod validate (the structured-
// output endpoint can't fit our schema), so Claude can return enum
// synonyms or empty strings instead of the canonical value. The
// schema's preprocess wrappers map known variants and fall back to
// "other" / "unstated" / "unclear" rather than 502'ing the parse.

function baseFixture(overrides: object): Record<string, unknown> {
  return {
    energy: null,
    sleep_quality: null,
    appetite: null,
    pain_current: null,
    pain_worst: null,
    mood_clarity: null,
    nausea: null,
    fatigue: null,
    anorexia: null,
    abdominal_pain: null,
    neuropathy_hands: null,
    neuropathy_feet: null,
    weight_kg: null,
    diarrhoea_count: null,
    cold_dysaesthesia: null,
    mouth_sores: null,
    fever: null,
    notes: null,
    clinic_visit: null,
    appointments_mentioned: null,
    medications_mentioned: null,
    imaging_results: null,
    lab_results: null,
    follow_up_questions: null,
    personal: null,
    confidence: "high",
    ...overrides,
  };
}

describe("VoiceMemoParseSchema enum tolerance", () => {
  it("normalises clinic_visit.kind synonyms instead of failing validation", () => {
    const cases = [
      { kind: "infusion", expect: "chemo" },
      { kind: "Chemotherapy", expect: "chemo" },
      { kind: "blood draw", expect: "blood_test" },
      { kind: "biopsy", expect: "procedure" },
      { kind: "surgery", expect: "procedure" },
      { kind: "Emergency department", expect: "ed" },
      { kind: "consult", expect: "clinic" },
      { kind: "review appointment", expect: "clinic" },
      // Unknown maps to fallback rather than failing.
      { kind: "something weird", expect: "other" },
      // Empty / nullish strings collapse to null.
      { kind: "", expect: null },
      { kind: "null", expect: null },
    ];
    for (const { kind, expect: want } of cases) {
      const parsed = VoiceMemoParseSchema.safeParse(
        baseFixture({
          clinic_visit: {
            kind,
            visit_date: null,
            provider: null,
            location: null,
            summary: "A visit happened.",
            key_points: null,
          },
        }),
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.clinic_visit?.kind).toBe(want);
      }
    }
  });

  it("normalises imaging modality synonyms", () => {
    const parsed = VoiceMemoParseSchema.safeParse(
      baseFixture({
        imaging_results: [
          {
            modality: "PET-CT",
            finding_summary: "all clear",
            status: "Normal",
            date: null,
          },
          {
            modality: "Sonogram",
            finding_summary: "fine",
            status: "all clear",
            date: null,
          },
        ],
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.imaging_results?.[0]?.modality).toBe("pet");
      expect(parsed.data.imaging_results?.[0]?.status).toBe("clear");
      expect(parsed.data.imaging_results?.[1]?.modality).toBe("ultrasound");
    }
  });

  it("normalises lab status synonyms (high → raised, fine → normal)", () => {
    const parsed = VoiceMemoParseSchema.safeParse(
      baseFixture({
        lab_results: [
          { name: "CA 19-9", value: "28", status: "high", date: null },
          { name: "white cells", value: null, status: "fine", date: null },
        ],
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lab_results?.[0]?.status).toBe("raised");
      expect(parsed.data.lab_results?.[1]?.status).toBe("normal");
    }
  });
});
