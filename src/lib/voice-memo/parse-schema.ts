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

// Tolerant enum coercion. The route uses messages.create + manual
// JSON.parse (Anthropic structured output exceeded the 24-optional /
// 16-union schema cap), so we don't get grammar-level enum
// enforcement — Claude can return synonyms, casings, or empty
// strings. Rather than 502 the parse, normalise:
//   · empty / whitespace / null-string → null
//   · case-insensitive direct match → use it
//   · synonym match → use the canonical value
//   · anything else → fallback (typically "other")
function tolerantEnum<T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
  synonyms: Record<string, T[number]> = {},
) {
  return z.preprocess((raw) => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") return fallback;
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === "" || trimmed === "null" || trimmed === "none") return null;
    const normalised = trimmed.replace(/[\s-]+/g, "_");
    if ((values as readonly string[]).includes(normalised)) return normalised;
    if ((values as readonly string[]).includes(trimmed)) return trimmed;
    // Substring synonym match — first hit wins.
    for (const key of Object.keys(synonyms)) {
      if (normalised.includes(key) || trimmed.includes(key)) {
        return synonyms[key];
      }
    }
    return fallback;
  }, z.enum(values).nullable());
}

const ClinicVisitKindField = tolerantEnum(
  ["clinic", "chemo", "scan", "blood_test", "procedure", "ed", "other"] as const,
  "other",
  {
    chemo: "chemo",
    infusion: "chemo",
    chemotherapy: "chemo",
    scan: "scan",
    imaging: "scan",
    pet: "scan",
    ct: "scan",
    mri: "scan",
    blood: "blood_test",
    bloods: "blood_test",
    pathology: "blood_test",
    biopsy: "procedure",
    surgery: "procedure",
    operation: "procedure",
    procedure: "procedure",
    emergency: "ed",
    ed: "ed",
    consult: "clinic",
    review: "clinic",
    appointment: "clinic",
  },
);

const AppointmentKindField = tolerantEnum(
  ["clinic", "chemo", "scan", "blood_test", "procedure", "other"] as const,
  "other",
  {
    chemo: "chemo",
    infusion: "chemo",
    chemotherapy: "chemo",
    scan: "scan",
    imaging: "scan",
    pet: "scan",
    ct: "scan",
    mri: "scan",
    blood: "blood_test",
    bloods: "blood_test",
    biopsy: "procedure",
    surgery: "procedure",
    operation: "procedure",
    procedure: "procedure",
    consult: "clinic",
    review: "clinic",
  },
);

const ImagingModalityField = tolerantEnum(
  ["pet", "ct", "mri", "ultrasound", "xray", "bone_scan", "other"] as const,
  "other",
  {
    "pet_ct": "pet",
    "pet/ct": "pet",
    petct: "pet",
    pet: "pet",
    ct: "ct",
    "ct_scan": "ct",
    mri: "mri",
    ultrasound: "ultrasound",
    us: "ultrasound",
    sonogram: "ultrasound",
    xray: "xray",
    "x_ray": "xray",
    bone: "bone_scan",
  },
);

const ImagingStatusField = tolerantEnum(
  ["clear", "stable", "improvement", "progression", "unclear"] as const,
  "unclear",
  {
    clear: "clear",
    normal: "clear",
    "all_clear": "clear",
    stable: "stable",
    unchanged: "stable",
    improvement: "improvement",
    improved: "improvement",
    better: "improvement",
    progression: "progression",
    progressed: "progression",
    worse: "progression",
    growing: "progression",
    unclear: "unclear",
    unknown: "unclear",
  },
);

const LabStatusField = tolerantEnum(
  ["normal", "raised", "low", "abnormal", "unstated"] as const,
  "unstated",
  {
    normal: "normal",
    fine: "normal",
    okay: "normal",
    raised: "raised",
    high: "raised",
    elevated: "raised",
    up: "raised",
    low: "low",
    down: "low",
    abnormal: "abnormal",
    off: "abnormal",
    unstated: "unstated",
    unknown: "unstated",
  },
);

const MealTypeField = tolerantEnum(
  ["breakfast", "lunch", "dinner", "snack"] as const,
  "snack",
  {
    breakfast: "breakfast",
    早餐: "breakfast",
    早饭: "breakfast",
    morning: "breakfast",
    lunch: "lunch",
    午餐: "lunch",
    午饭: "lunch",
    noon: "lunch",
    dinner: "dinner",
    晚餐: "dinner",
    晚饭: "dinner",
    supper: "dinner",
    snack: "snack",
    宵夜: "snack",
    加餐: "snack",
  },
);

const FluidKindField = tolerantEnum(
  // Aligned with nutrition.ts FluidKind so the apply step writes
  // straight into fluid_logs without mapping.
  ["water", "tea", "coffee", "broth", "electrolyte", "soup", "other"] as const,
  "water",
  {
    water: "water",
    水: "water",
    tea: "tea",
    茶: "tea",
    coffee: "coffee",
    咖啡: "coffee",
    juice: "other",
    果汁: "other",
    broth: "broth",
    汤: "soup",
    soup: "soup",
    electrolyte: "electrolyte",
    sports: "electrolyte",
    "gatorade": "electrolyte",
  },
);

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
      kind: ClinicVisitKindField.describe(
        "Kind of clinical encounter the memo describes. Use 'chemo' for any infusion/chemotherapy session (化疗/输液), 'scan' for imaging visits, 'blood_test' for blood draws (抽血), 'procedure' for biopsies/operations (活检/手术), 'ed' for emergency-department visits, 'clinic' for consult appointments. Maps to existing appointment kinds so the apply step can flip a matching scheduled appointment to attended.",
      ),
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
        .describe("Decisions made / instructions given / dosage changes / observations during the encounter (e.g. 'felt normal during the infusion', 'ate a sandwich, drank water'). Null when none."),
    })
    .nullish()
    .describe(
      "Set whenever the memo describes a clinical encounter that already happened — clinic consult, chemo / infusion session, scan, blood draw, procedure, or ED visit. Set even when the memo is narratively personal (e.g. 'wife came with me to chemo'); the encounter still warrants a clinic_visit. Null only when the memo is pure symptom logging or non-clinical.",
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
        kind: AppointmentKindField,
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

  // ---- Imaging results the patient mentions (PET, CT, MRI, ultrasound,
  //      bone scan). Strictly clinical — NEVER goes into the personal
  //      block. Surfaced in the preview as info chips; not auto-filed
  //      into /imaging because those rows have stricter schemas that
  //      need explicit confirmation.
  imaging_results: z
    .array(
      z.object({
        modality: ImagingModalityField.describe(
          "Scan type. Use 'other' rather than guessing when ambiguous.",
        ),
        finding_summary: z
          .string()
          .describe("One short phrase: 'all clear', 'liver lesion stable', 'new node in mediastinum'."),
        status: ImagingStatusField.describe(
          "Patient's interpretation of the result.",
        ),
        date: z
          .string()
          .nullish()
          .describe("ISO date when stated; null otherwise."),
      }),
    )
    .nullish()
    .describe(
      "Imaging the patient is reporting on. Empty / null when none. Always clinical, never personal.",
    ),

  // ---- Lab / blood results the patient mentions (white cells, CA 19-9,
  //      CEA, LFTs, etc.). Strictly clinical, surfaced as preview chips.
  lab_results: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Lab name as the patient said it: 'white cells', 'CA 19-9', 'liver enzymes'."),
        value: z
          .string()
          .nullish()
          .describe("Numeric value or descriptor as stated; null when not given."),
        status: LabStatusField.describe(
          "Patient's interpretation of the result.",
        ),
        date: z.string().nullish(),
      }),
    )
    .nullish()
    .describe(
      "Lab / blood-test mentions. Empty / null when none. Always clinical, never personal.",
    ),

  // ---- Follow-up questions to surface back to the patient. Lets the
  //      app feel like a thoughtful nurse / dietician / physio gently
  //      asking what's missing. Max 2 — we don't interrogate.
  // ---- Nutrition: foods + drinks the patient actually consumed.
  //      Drives the meal_entries / meal_items / fluid_logs tables.
  //      Different from `personal.food_mentions` (which is for
  //      narrative reflection) — this block writes the structured log.
  nutrition: z
    .object({
      meals: z
        .array(
          z.object({
            meal_type: MealTypeField,
            items: z
              .array(
                z.object({
                  name: z
                    .string()
                    .describe("Food name in English when straightforward, otherwise the patient's wording."),
                  name_zh: z
                    .string()
                    .nullish()
                    .describe("Mandarin name when the patient said it in zh."),
                  qty_label: z
                    .string()
                    .nullish()
                    .describe("Patient's quantity wording: '2 pieces', '一碗', 'small bowl'. Null when not stated."),
                  est_grams: z
                    .number()
                    .nullish()
                    .describe("Estimated serving in grams when you can defend it (cheese slice ≈ 20g, sandwich ≈ 150g, egg ≈ 50g). Null when truly unknowable."),
                }),
              )
              .describe("One item per distinct food the patient mentioned eating."),
          }),
        )
        .nullish()
        .describe("Empty / null when the memo doesn't describe eating."),
      fluids: z
        .array(
          z.object({
            kind: FluidKindField,
            est_ml: z
              .number()
              .nullish()
              .describe("Estimated millilitres when the patient gave a quantity (a cup ≈ 250ml, a glass ≈ 200ml). Null when truly unknown."),
            qty_label: z
              .string()
              .nullish()
              .describe("Patient's quantity wording: '一杯', 'a glass'. Null when not stated."),
          }),
        )
        .nullish()
        .describe("Empty / null when the memo doesn't describe drinking."),
    })
    .nullish()
    .describe(
      "Drives the meal log + hydration log. Always populate when the patient mentions eating or drinking (including snacks during chemo / clinic visits). Estimate grams / ml when you can; leave null when you'd be guessing.",
    ),

  follow_up_questions: z
    .array(z.string())
    .nullish()
    .describe(
      "0–2 short questions a thoughtful clinical-tracking nurse would ask. Each question MUST elicit an objective rating or count, never a yes/no. Anchor on the project's standard scales: 0–10 for energy / sleep_quality / appetite / pain / mood / nausea / fatigue / anorexia / abdominal_pain, CTCAE 0–4 for neuropathy, hours for sleep duration, kg for weight, count for diarrhoea episodes. Examples: 'On a 0–10 scale, how strong was the nausea during the infusion?' / '今天最痛的时候 0 到 10 是几分？' / 'How many hours did you sleep last night?'. NEVER ask 'did you feel X' or 'was it Y'. Skip entirely when the memo is already concrete. Phrase warmly, in the memo's language.",
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

HARD CHECK before finalising the JSON. Scan the transcript for these anchors. If ANY appears, the corresponding structured field MUST be set — no exceptions, even when the rest of the memo is personal narrative:

  · 化疗 / chemo / chemotherapy / infusion / 输液 → \`clinic_visit.kind\` = "chemo"
  · 扫描 / scan / CT / MRI / PET / ultrasound / 超声 → \`clinic_visit.kind\` = "scan" AND \`imaging_results\` populated when a result is reported
  · 抽血 / blood test / bloods / pathology → \`clinic_visit.kind\` = "blood_test" AND \`lab_results\` populated when a value is reported
  · 活检 / biopsy / 手术 / surgery / 操作 / procedure → \`clinic_visit.kind\` = "procedure"
  · 急诊 / emergency / ED → \`clinic_visit.kind\` = "ed"
  · 看医生 / 复诊 / 会诊 / consult / clinic visit → \`clinic_visit.kind\` = "clinic"
  · ANY food or drink the patient mentions consuming → \`nutrition.meals\` (food items) and/or \`nutrition.fluids\` (drinks). DO NOT only put food in \`personal.food_mentions\` when it's eaten — the personal block is for narrative reflection, the nutrition block drives the meal log.

Few-shot example (chemo + nutrition + family):

Transcript: "今天儿子陪我去做化疗,过程很顺利,中间吃了三明治和两片cheese,喝了水,上了两次厕所。"
Output:
{
  "clinic_visit": {
    "kind": "chemo",
    "summary": "First chemo session, went smoothly. Family member accompanied. Patient ate during the infusion and reports normal bathroom function.",
    "key_points": ["Ate sandwich + 2 pieces cheese during infusion", "Drank water", "Two bathroom visits — felt normal"],
    "visit_date": null, "provider": null, "location": null
  },
  "personal": {
    "family_mentions": ["儿子陪我去做化疗"],
    "food_mentions": [], "practice_mentions": [], "goals": [],
    "mood_narrative": null, "observations": null
  },
  "nutrition": {
    "meals": [
      { "meal_type": "snack", "items": [{ "name": "sandwich" }, { "name": "cheese", "qty_label": "2 pieces" }] }
    ],
    "fluids": [
      { "kind": "water" }
    ]
  },
  "confidence": "high",
  ... (other fields null)
}

Output rules:
1. Numeric scales are 0–10 unless noted. Map clear qualitative anchors when an explicit number isn't given (see field descriptions). Set \`null\` whenever you'd be guessing.
2. Neuropathy is CTCAE 0–4. Be conservative: vague tingling is grade 1, only set ≥2 if the patient describes interference with hand or foot function. \`null\` otherwise.
3. Booleans only flip true. Set \`null\` rather than \`false\` when the patient doesn't mention the symptom — silence is not denial.
4. \`notes\` is reserved for short clinical addenda that didn't fit a structured field (a taste change, a side-effect attribution). Personal content (food, family, practice, goals, mood) belongs in the \`personal\` block — never in \`notes\`.
5. \`clinic_visit\` covers ANY past clinical encounter — clinic consult, chemo / infusion session, scan, blood draw, procedure, ED visit. Set it whenever the memo says "had / went to / just got back from / 化疗 / 来做 / 看了医生 / 抽血 / 扫描 / 活检", even when the rest of the memo is narratively personal (e.g. who came with the patient, what they ate during the infusion). Set \`kind\` to map the encounter to the matching appointment kind. Do not invent providers; resolve nicknames only when context is clear ("Sumi" → "A/Prof Sumitra Ananda" when the memo is about oncology). \`null\` only for pure symptom-log or non-clinical memos.
6. \`appointments_mentioned\` only for events that haven't happened yet. Set \`confidence: high\` only when both date and title are concrete; vague mentions ("scan sometime next week") are medium or low and won't auto-schedule downstream. Empty array when nothing concrete.
7. \`imaging_results\` and \`lab_results\` are STRICTLY clinical — never put scan or blood-test mentions in \`personal\` or \`notes\`. "PET CT clear", "CT stable", "white cells normal", "CA 19-9 dropped" are imaging or lab entries with their own structured fields. Empty / null when none.
8. \`personal\` is the diary half — populate when the patient mentions food, family, practice, goals, or mood. Inner string-array fields are empty arrays when nothing matches; \`mood_narrative\` and \`observations\` are \`null\` when nothing matches. Set the whole \`personal\` object to \`null\` only when the memo is purely clinical with no personal flavour at all. Scan / lab / medication mentions belong to their clinical fields, NOT here. Family / food / practice / goals during a clinical encounter still go here, AND the encounter itself goes in \`clinic_visit\` — both can be populated together.
9. \`follow_up_questions\`: act like a clinical-tracking nurse who needs objective ratings to log. Each question MUST anchor on a numeric scale or concrete count — NEVER yes/no. Use 0–10 for energy / sleep / appetite / pain / mood / nausea / fatigue / abdominal pain, CTCAE 0–4 for neuropathy, hours for sleep duration, count for diarrhoea, kg for weight. Bad: "did you feel tired?" / "was the nausea bad?". Good: "On a 0–10 scale, how strong was the nausea during the infusion?" / "今天最累的时候 0 到 10 是几分？". Skip entirely when the memo is already concrete. Never ask more than 2.
10. Set the top-level \`confidence\` honestly. low when transcripts are short, garbled, or only mention vague feelings. high only when the memo carries clear, unambiguous structured signal.
11. Never invent specific numbers, weights, dates, or medications.`;
}
