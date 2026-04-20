import { z } from "zod";

const scale0to10 = z.number().min(0).max(10);

export const dailyEntrySchema = z.object({
  date: z.string(),
  entered_by: z.enum(["hulin", "catherine", "thomas"]),
  energy: scale0to10,
  sleep_quality: scale0to10,
  appetite: scale0to10,
  pain_worst: scale0to10,
  pain_current: scale0to10,
  mood_clarity: scale0to10,
  nausea: scale0to10,
  weight_kg: z.number().min(20).max(200).optional(),
  steps: z.number().int().min(0).max(200000).optional(),
  practice_morning_completed: z.boolean(),
  practice_morning_quality: z.number().min(0).max(5).optional(),
  practice_evening_completed: z.boolean(),
  practice_evening_quality: z.number().min(0).max(5).optional(),
  cold_dysaesthesia: z.boolean(),
  neuropathy_hands: z.boolean(),
  neuropathy_feet: z.boolean(),
  mouth_sores: z.boolean(),
  diarrhoea_count: z.number().int().min(0).max(30),
  new_bruising: z.boolean(),
  dyspnoea: z.boolean(),
  fever: z.boolean(),
  fever_temp: z.number().min(30).max(45).optional(),
  reflection: z.string().max(4000).optional(),
  reflection_lang: z.enum(["en", "zh"]).optional(),
  protein_grams: z.number().min(0).max(500).optional(),
  meals_count: z.number().int().min(0).max(10).optional(),
  snacks_count: z.number().int().min(0).max(10).optional(),
  fluids_ml: z.number().min(0).max(10000).optional(),
  walking_minutes: z.number().min(0).max(720).optional(),
  resistance_training: z.boolean().optional(),
  other_exercise_minutes: z.number().min(0).max(720).optional(),
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;

export const settingsSchema = z.object({
  profile_name: z.string().min(1),
  dob: z.string().optional(),
  diagnosis_date: z.string().optional(),
  height_cm: z.number().min(100).max(230).optional(),
  baseline_weight_kg: z.number().min(20).max(200).optional(),
  baseline_date: z.string().optional(),
  baseline_grip_dominant_kg: z.number().min(0).max(100).optional(),
  baseline_grip_nondominant_kg: z.number().min(0).max(100).optional(),
  baseline_gait_speed_ms: z.number().min(0).max(3).optional(),
  baseline_sit_to_stand: z.number().int().min(0).max(50).optional(),
  baseline_muac_cm: z.number().min(15).max(50).optional(),
  baseline_calf_cm: z.number().min(20).max(60).optional(),
  locale: z.enum(["en", "zh"]),
  managing_oncologist: z.string().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export const fortnightlyAssessmentSchema = z.object({
  assessment_date: z.string(),
  entered_by: z.enum(["hulin", "catherine", "thomas"]),
  ecog_self: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  grip_dominant_kg: z.number().min(0).max(100).optional(),
  grip_nondominant_kg: z.number().min(0).max(100).optional(),
  gait_speed_ms: z.number().min(0).max(3).optional(),
  sit_to_stand_30s: z.number().int().min(0).max(50).optional(),
  muac_cm: z.number().min(15).max(50).optional(),
  calf_circumference_cm: z.number().min(20).max(60).optional(),
  neuropathy_grade: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ])
    .optional(),
  pro_ctcae_fatigue_severity: z.number().int().min(0).max(4).optional(),
  pro_ctcae_fatigue_interference: z.number().int().min(0).max(4).optional(),
  pro_ctcae_neuropathy_severity: z.number().int().min(0).max(4).optional(),
  pro_ctcae_neuropathy_interference: z.number().int().min(0).max(4).optional(),
  pro_ctcae_pain_severity: z.number().int().min(0).max(4).optional(),
  pro_ctcae_pain_interference: z.number().int().min(0).max(4).optional(),
  pro_ctcae_diarrhoea_frequency: z.number().int().min(0).max(4).optional(),
  distress_thermometer: z.number().min(0).max(10).optional(),
  phq9_total: z.number().min(0).max(27).optional(),
  gad7_total: z.number().min(0).max(21).optional(),
});

export type FortnightlyAssessmentInput = z.infer<
  typeof fortnightlyAssessmentSchema
>;
