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
      "Anything noteworthy that doesn't fit a structured field — taste changes, food eaten, conversations, observations. Keep concise: 1–3 short sentences.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "high: explicit numerics or unambiguous descriptions. medium: clear qualitative anchors. low: only vague mentions, transcript noise, or speech-recognition garbage.",
    ),
});

export type VoiceMemoParseResult = z.infer<typeof VoiceMemoParseSchema>;

export function buildVoiceMemoParseSystem(
  profile: HouseholdProfile = FALLBACK_HOUSEHOLD_PROFILE,
): string {
  return `You read short voice-memo transcripts from ${profile.patient_initials}, a patient with ${profile.diagnosis_full} on first-line gemcitabine + nab-paclitaxel, and extract structured daily-tracking fields.

The memo is a self-report — the patient is telling their diary how the day went. Extract only fields the patient actually verbalises. Never infer from absence: a memo that doesn't mention pain doesn't mean pain=0. Leave the field unset.

Output rules:
1. Every field is optional. Set a value only if the transcript supports it.
2. Numeric scales are 0–10 unless noted. Map clear qualitative anchors when an explicit number isn't given (see field descriptions). Reject anything you'd guess.
3. Neuropathy is CTCAE 0–4. Be conservative: vague tingling is grade 1, only set ≥2 if the patient describes interference with hand or foot function.
4. Booleans only flip true. Never set a boolean false on the strength of silence.
5. Anything noteworthy that doesn't map to a structured field belongs in \`notes\` (taste changes, foods eaten, conversations, mood detail). Keep notes brief and faithful — don't add analysis.
6. Set \`confidence\` honestly. low when transcripts are short, garbled, or only mention vague feelings. high only when the patient gives clear numbers or unambiguous descriptions.
7. Never invent specific numbers, weights, dates, or medications. If the transcript is too vague, return \`{"confidence": "low"}\` with no other fields.
8. Translate Mandarin or mixed Mandarin/English memos before extracting — the structured fields are language-neutral, but \`notes\` should follow the memo's language.`;
}
