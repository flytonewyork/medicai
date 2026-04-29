import { z } from "zod/v4";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";

// Schema for the structured fields Claude extracts from a patient's
// voice memo. Anthropic's structured-output endpoint caps optional
// parameters at 24 across the entire schema (counted recursively),
// and this surface is broad — daily-tracking + clinic visit + future
// appointments + medications + personal content. We keep every field
// required-but-nullable instead: Claude MUST emit every key, with
// `null` (or `[]` for arrays) when the memo didn't mention that
// field. Same semantic, zero optional-parameter count.
//
// The shipped flow is preview-then-confirm on `/memos/[id]` (and an
// auto-apply on `confidence: high`), so the safe-merge step copies
// only those numerics + booleans the patient actually verbalised —
// nulls are dropped before they reach `daily_entries`.

const ZeroToTen = z.number().min(0).max(10);

const NeuropathyGrade = z
  .number()
  .int()
  .min(0)
  .max(4)
  .describe(
    "CTCAE 0–4. 0=none, 1=tingling/cold dysaesthesia only, 2=interferes with fine motor (buttons, keys), 3=limits ADLs, 4=disabling.",
  );

const ConfidenceEnum = z.enum(["low", "medium", "high"]);

export const VoiceMemoParseSchema = z.object({
  // ---- Daily-tracking fields. All required-nullable. Set the value
  //      when the memo states it (number or clear qualitative anchor),
  //      null otherwise.
  energy: ZeroToTen
    .nullish()
    .describe(
      "0–10 self-rated energy. 'exhausted'→2, 'sluggish'→4, 'normal'→6, 'good'→7. Null when not mentioned.",
    ),
  sleep_quality: ZeroToTen
    .nullish()
    .describe("0–10. 'awful sleep'→2, 'broken'→4, 'okay'→6, 'great'→8."),
  appetite: ZeroToTen
    .nullish()
    .describe("0–10. 'no appetite'→1, 'forced myself to eat'→3, 'normal'→6."),
  pain_current: ZeroToTen.nullish().describe("Pain 0–10 right now."),
  pain_worst: ZeroToTen.nullish().describe("Worst pain today, 0–10."),
  mood_clarity: ZeroToTen
    .nullish()
    .describe("0–10. 'foggy'→3, 'clear-headed'→8."),
  nausea: ZeroToTen.nullish().describe("0–10 nausea severity."),
  fatigue: ZeroToTen.nullish(),
  anorexia: ZeroToTen
    .nullish()
    .describe("0–10 loss-of-desire-to-eat severity."),
  abdominal_pain: ZeroToTen.nullish(),
  neuropathy_hands: NeuropathyGrade.nullish(),
  neuropathy_feet: NeuropathyGrade.nullish(),
  weight_kg: z
    .number()
    .min(20)
    .max(200)
    .nullish()
    .describe("Only when the patient states a weight. Reject implausible values."),
  diarrhoea_count: z
    .number()
    .int()
    .min(0)
    .max(20)
    .nullish()
    .describe("Number of loose stools today, when stated."),
  cold_dysaesthesia: z
    .boolean()
    .nullish()
    .describe(
      "True when the patient describes cold-triggered tingling or pain. Null when not mentioned. Never set false on the strength of silence.",
    ),
  mouth_sores: z.boolean().nullish(),
  fever: z.boolean().nullish(),
  notes: z
    .string()
    .nullish()
    .describe(
      "Anything CLINICALLY noteworthy that doesn't fit a structured field — taste changes, side-effect attributions. 1–3 short sentences. Personal content (food, family, practice) belongs in `personal`, not here.",
    ),

  // ---- Clinic visit summary. Required-nullable object. Null when
  //      the memo doesn't describe a clinical encounter that already
  //      happened. When present, every inner field is also required-
  //      nullable to keep the optional-parameter count at zero.
  clinic_visit: z
    .object({
      visit_date: z
        .string()
        .nullish()
        .describe("ISO date of the visit. Null when the patient didn't say."),
      provider: z
        .string()
        .nullish()
        .describe("Provider name. 'Sumi'→'A/Prof Sumitra Ananda' when context is clear."),
      location: z.string().nullish(),
      summary: z
        .string()
        .describe("1–3 sentence summary of what happened in the visit."),
      key_points: z
        .array(z.string())
        .nullish()
        .describe("Decisions made / instructions given / dosage changes. Null when none."),
    })
    .nullish()
    .describe(
      "Set only when the patient describes a clinical encounter that already happened. Null for symptom-only memos.",
    ),

  // ---- Future appointments mentioned. Tolerant of missing key.
  appointments_mentioned: z
    .array(
      z.object({
        title: z
          .string()
          .describe("Short label, e.g. 'Cycle 3 chemo' or 'PET-CT scan'."),
        starts_at: z
          .string()
          .nullish()
          .describe("ISO datetime when stated; null otherwise."),
        location: z.string().nullish(),
        doctor: z.string().nullish(),
        prep: z
          .string()
          .nullish()
          .describe("Prep instructions: fasting, items to bring, hydration."),
        kind: z
          .enum(["clinic", "chemo", "scan", "blood_test", "procedure", "other"])
          .nullish(),
        confidence: ConfidenceEnum.describe(
          "high only when both date and title are concrete; low/medium are surfaced as hints, not auto-scheduled.",
        ),
      }),
    )
    .nullish()
    .describe("Empty array (or null/omitted) when the memo mentions no future appointments."),

  // ---- Medications mentioned. Tolerant of missing key.
  medications_mentioned: z
    .array(
      z.object({
        name: z.string().describe("Drug name as the patient said it."),
        detail: z
          .string()
          .nullish()
          .describe("Brief context: dose timing, missed dose, side-effect attribution."),
      }),
    )
    .nullish()
    .describe("Empty array (or null/omitted) when no medications are discussed."),

  // ---- Personal (non-clinical) content. Nullable object — null when
  //      the memo is purely clinical. Stored on the memo only, never
  //      synced to cloud (the sync hook scrubs this key).
  personal: z
    .object({
      food_mentions: z
        .array(z.string())
        .nullish()
        .describe("Foods or drinks the patient mentions. Empty / null when none."),
      family_mentions: z
        .array(z.string())
        .nullish()
        .describe("Family or carer interactions. Empty / null when none."),
      practice_mentions: z
        .array(z.string())
        .nullish()
        .describe("Qigong, meditation, walks, breathing. Empty / null when none."),
      goals: z
        .array(z.string())
        .nullish()
        .describe("Things the patient says they intend to do. Empty / null when none."),
      mood_narrative: z
        .string()
        .nullish()
        .describe("One short sentence about how the patient feels in their own words. Null when no mood content."),
      observations: z
        .string()
        .nullish()
        .describe("Anything else worth keeping. Null when nothing extra."),
    })
    .nullish()
    .describe(
      "Non-clinical content. Set when the patient mentions food, family, practice, goals, or mood. Null otherwise.",
    ),

  confidence: ConfidenceEnum.describe(
    "Overall extraction confidence. high: explicit numerics or unambiguous descriptions. medium: clear qualitative anchors. low: only vague mentions, transcript noise, or speech-recognition garbage.",
  ),
});

export type VoiceMemoParseResult = z.infer<typeof VoiceMemoParseSchema>;

export function buildVoiceMemoParseSystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  return `You read voice-memo transcripts from ${profile.patient_initials}, a patient with ${profile.diagnosis_full} on first-line gemcitabine + nab-paclitaxel, and extract a full structured picture of the memo: clinical tracking fields, clinic visit summaries, scheduled appointments, medications discussed, AND non-clinical personal content.

The memo is the patient's diary — sometimes a symptom log, sometimes a clinic recap, sometimes a record of who they spoke to and what they ate. Extract every aspect that's present.

Mandarin or mixed Mandarin/English memos: translate internally before extracting. Free-text fields (\`notes\`, \`mood_narrative\`, \`observations\`, family/practice/food phrases) preserve the memo's original language so the patient sees their own words; structured numerics and enum-typed fields are language-neutral.

Required-nullable schema: every field is required, but you set it to \`null\` (or to an empty array for list fields) when the memo doesn't carry that signal. Never invent values. The downstream system treats \`null\` as "the patient didn't say."

Output rules:
1. Numeric scales are 0–10 unless noted. Map clear qualitative anchors when an explicit number isn't given (see field descriptions). Set \`null\` whenever you'd be guessing.
2. Neuropathy is CTCAE 0–4. Be conservative: vague tingling is grade 1, only set ≥2 if the patient describes interference with hand or foot function. \`null\` otherwise.
3. Booleans only flip true. Set \`null\` rather than \`false\` when the patient doesn't mention the symptom — silence is not denial.
4. \`notes\` is reserved for short clinical addenda that didn't fit a structured field (a taste change, a side-effect attribution). Personal content (food, family, practice, goals, mood) belongs in the \`personal\` block — never in \`notes\`.
5. \`clinic_visit\` only when the patient describes a clinical encounter that already happened. Do not invent providers; resolve nicknames only when context is clear ("Sumi" → "A/Prof Sumitra Ananda" when the memo is about oncology). \`null\` otherwise.
6. \`appointments_mentioned\` only for events that haven't happened yet. Set \`confidence: high\` only when both date and title are concrete; vague mentions ("scan sometime next week") are medium or low and won't auto-schedule downstream. Empty array when nothing concrete.
7. \`personal\` is the diary half — populate when the patient mentions food, family, practice, goals, or mood. Inner string-array fields are empty arrays when nothing matches; \`mood_narrative\` and \`observations\` are \`null\` when nothing matches. Set the whole \`personal\` object to \`null\` only when the memo is purely clinical with no personal flavour at all.
8. Set the top-level \`confidence\` honestly. low when transcripts are short, garbled, or only mention vague feelings. high only when the memo carries clear, unambiguous structured signal.
9. Never invent specific numbers, weights, dates, or medications.`;
}
