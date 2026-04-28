import { z } from "zod/v4";
import {
  FALLBACK_HOUSEHOLD_PROFILE,
  type HouseholdProfile,
} from "~/types/household-profile";

// Schema for the daily-form fields Claude extracts from a patient
// voice memo. Every field is optional — Claude only sets values it
// can defend from the transcript. Anything ambiguous goes into
// `notes` instead so the patient can confirm without losing context.
//
// Fields mirror `DailyEntry` so the safe-merge step can copy them
// straight across. Confidence drives whether daily_entries gets
// written — low/medium results stay on the memo card only.

const ZeroToTen = z
  .number()
  .min(0)
  .max(10);

const NeuropathyGrade = z
  .number()
  .int()
  .min(0)
  .max(4)
  .describe(
    "CTCAE 0–4. 0=none, 1=tingling/cold dysaesthesia only, 2=interferes with fine motor (buttons, keys), 3=limits ADLs, 4=disabling.",
  );

export const VoiceMemoParseSchema = z.object({
  energy: ZeroToTen
    .nullable()
    .optional()
    .describe(
      "0–10 self-rated energy. Set only when verbalised: a number, a clear word like 'exhausted'→2, 'sluggish'→4, 'normal'→6, 'good'→7.",
    ),
  sleep_quality: ZeroToTen
    .nullable()
    .optional()
    .describe("0–10. 'awful sleep'→2, 'broken'→4, 'okay'→6, 'great'→8."),
  appetite: ZeroToTen
    .nullable()
    .optional()
    .describe("0–10. 'no appetite'→1, 'forced myself to eat'→3, 'normal'→6."),
  pain_current: ZeroToTen
    .nullable()
    .optional()
    .describe("Pain 0–10 right now."),
  pain_worst: ZeroToTen
    .nullable()
    .optional()
    .describe("Worst pain today, 0–10."),
  mood_clarity: ZeroToTen
    .nullable()
    .optional()
    .describe("0–10. 'foggy'→3, 'clear-headed'→8."),
  nausea: ZeroToTen.nullable().optional().describe("0–10 nausea severity."),
  fatigue: ZeroToTen.nullable().optional(),
  anorexia: ZeroToTen
    .nullable()
    .optional()
    .describe("0–10 loss-of-desire-to-eat severity."),
  abdominal_pain: ZeroToTen.nullable().optional(),
  neuropathy_hands: NeuropathyGrade.nullable().optional(),
  neuropathy_feet: NeuropathyGrade.nullable().optional(),
  weight_kg: z
    .number()
    .min(20)
    .max(200)
    .nullable()
    .optional()
    .describe("Only when the patient states a weight. Reject implausible values."),
  diarrhoea_count: z
    .number()
    .int()
    .min(0)
    .max(20)
    .nullable()
    .optional()
    .describe("Number of loose stools today, when stated."),
  cold_dysaesthesia: z
    .boolean()
    .nullable()
    .optional()
    .describe(
      "True when the patient describes cold-triggered tingling or pain (e.g. 'fridge feels electric'). Never set false on a memo that doesn't mention it.",
    ),
  mouth_sores: z.boolean().nullable().optional(),
  fever: z.boolean().nullable().optional(),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Anything CLINICALLY noteworthy that doesn't fit a structured field — taste changes, observations about side-effects, response to medication. Keep concise: 1–3 short sentences. Do NOT include personal content (food, family, practice) — those are parsed on-device separately.",
    ),
  // Slice 3: clinic visit summary. Set when the memo describes a
  // medical encounter that already happened (consult, phone call,
  // chemo session). Goes into life_events as a medical/non-memory row.
  clinic_visit: z
    .object({
      visit_date: z
        .string()
        .nullable()
        .optional()
        .describe("ISO date of the visit. Default to today if the patient says 'just got back'."),
      provider: z
        .string()
        .nullable()
        .optional()
        .describe("Provider name. Resolve nicknames: 'Sumi'→'A/Prof Sumitra Ananda', 'Mark'→'Mark Cullinan' when context fits."),
      location: z.string().nullable().optional(),
      summary: z
        .string()
        .describe("1–3 sentence summary of what happened in the visit."),
      key_points: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Decisions made, instructions given, dosage changes — one short bullet each."),
    })
    .nullable()
    .optional()
    .describe("Set only when the patient describes a clinical encounter that already happened. Skip when the memo is purely symptom logging."),
  // Slice 3: future appointments mentioned in the memo. Goes into the
  // appointments table when the date+title look concrete. We never
  // overwrite an existing appointment — the apply step inserts new
  // rows and the patient confirms in /schedule.
  appointments_mentioned: z
    .array(
      z.object({
        title: z
          .string()
          .describe("Short label, e.g. 'Cycle 3 chemo' or 'PET-CT scan'."),
        starts_at: z
          .string()
          .nullable()
          .optional()
          .describe("ISO datetime if the patient stated a specific date and time. Leave null if vague."),
        location: z.string().nullable().optional(),
        doctor: z.string().nullable().optional(),
        prep: z
          .string()
          .nullable()
          .optional()
          .describe("Prep instructions: fasting hours, items to bring, hydration etc."),
        kind: z
          .enum(["clinic", "chemo", "scan", "blood_test", "procedure", "other"])
          .nullable()
          .optional(),
        confidence: z
          .enum(["low", "medium", "high"])
          .describe("high only when both date and title are concrete. low/medium are surfaced on the memo card but not auto-scheduled."),
      }),
    )
    .nullable()
    .optional(),
  // Slice 3: medications the patient discussed. We don't auto-file
  // medication_events here — adherence has its own surface — but the
  // diary card surfaces what was discussed for context.
  medications_mentioned: z
    .array(
      z.object({
        name: z.string().describe("Drug name as the patient said it."),
        detail: z
          .string()
          .nullable()
          .optional()
          .describe("Brief context: dose timing, missed dose, side effect attribution."),
      }),
    )
    .nullable()
    .optional(),
  // Slice 3: personal content extracted by Claude. These fields hold
  // non-clinical detail — food eaten, family interactions, spiritual
  // practice notes, mood narrative, goals. They sit on the memo so the
  // patient can review their own day; the apply step does NOT fan them
  // out to clinical tables, and the sync hook scrubs them before push
  // so personal content stays on the recording device.
  personal: z
    .object({
      food_mentions: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Foods or drinks the patient mentions, kept as short phrases."),
      family_mentions: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Family or carer interactions — phone calls, visits, conversations."),
      practice_mentions: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Qigong, meditation, walks, breathing — patient's spiritual / movement practice."),
      goals: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("Things the patient says they intend to do (later today, tomorrow, this week)."),
      mood_narrative: z
        .string()
        .nullable()
        .optional()
        .describe("One short sentence describing how the patient feels in their own words."),
      observations: z
        .string()
        .nullable()
        .optional()
        .describe("Anything else worth keeping that didn't fit a structured slot."),
    })
    .nullable()
    .optional()
    .describe("Non-clinical content. Always extract when present — this is what makes the memo a diary, not just a symptom log."),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
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

Output rules:
1. Every field is optional. Set a value only if the transcript supports it.
2. Numeric scales are 0–10 unless noted. Map clear qualitative anchors when an explicit number isn't given (see field descriptions). Reject anything you'd guess.
3. Neuropathy is CTCAE 0–4. Be conservative: vague tingling is grade 1, only set ≥2 if the patient describes interference with hand or foot function.
4. Booleans only flip true. Never set a boolean false on the strength of silence — silence is not denial.
5. \`notes\` is reserved for short clinical addenda that didn't fit a structured field (a taste change, a side-effect attribution). Personal content (food, family, practice, goals, mood) belongs in the \`personal\` block — never in \`notes\`.
6. \`clinic_visit\` only when the patient describes a clinical encounter that already happened. Do not invent providers; resolve nicknames only when context is clear ("Sumi" → "A/Prof Sumitra Ananda" when the memo is about oncology).
7. \`appointments_mentioned\` only for events that haven't happened yet. Set \`confidence: high\` only when both date and title are concrete; vague mentions ("scan sometime next week") are medium or low and won't auto-schedule downstream.
8. \`personal\` is the diary half — always populate when the patient mentions food, family, practice, goals, or mood. Keep phrases short and faithful; don't add analysis.
9. Set the top-level \`confidence\` honestly. low when transcripts are short, garbled, or only mention vague feelings. high only when the memo carries clear, unambiguous structured signal.
10. Never invent specific numbers, weights, dates, or medications. If the whole memo is vague, return \`{"confidence": "low"}\` with whatever personal fields apply and no clinical structured values.`;
}
