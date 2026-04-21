import { z } from "zod";

const scale0to10 = z.number().min(0).max(10);

// Every field except date + entered_by is optional. The picker-style
// wizard in /daily/new only records categories the patient actually
// touched; "skipped" categories leave their fields undefined rather than
// defaulting to zero/false (which used to read as "patient affirmed no
// symptoms" rather than "didn't say").
export const dailyEntrySchema = z.object({
  date: z.string(),
  entered_by: z.enum(["hulin", "catherine", "thomas"]),
  entered_by_user_id: z.string().uuid().optional(),
  energy: scale0to10.optional(),
  sleep_quality: scale0to10.optional(),
  appetite: scale0to10.optional(),
  pain_worst: scale0to10.optional(),
  pain_current: scale0to10.optional(),
  mood_clarity: scale0to10.optional(),
  nausea: scale0to10.optional(),
  weight_kg: z.number().min(20).max(200).optional(),
  steps: z.number().int().min(0).max(200000).optional(),
  practice_morning_completed: z.boolean().optional(),
  practice_morning_quality: z.number().min(0).max(5).optional(),
  practice_evening_completed: z.boolean().optional(),
  practice_evening_quality: z.number().min(0).max(5).optional(),
  cold_dysaesthesia: z.boolean().optional(),
  // CTCAE 0–4. Legacy records may have booleans; the wizard coerces
  // on read, so accept both for backwards compatibility.
  neuropathy_hands: z.union([z.number().int().min(0).max(4), z.boolean()]).optional(),
  neuropathy_feet: z.union([z.number().int().min(0).max(4), z.boolean()]).optional(),
  mouth_sores: z.boolean().optional(),
  diarrhoea_count: z.number().int().min(0).max(30).optional(),
  new_bruising: z.boolean().optional(),
  dyspnoea: z.boolean().optional(),
  fever: z.boolean().optional(),
  fever_temp: z.number().min(30).max(45).optional(),
  // Curated symptom additions.
  fatigue: scale0to10.optional(),
  anorexia: scale0to10.optional(),
  abdominal_pain: scale0to10.optional(),
  taste_changes: z.number().min(0).max(5).optional(),
  steatorrhoea: z.boolean().optional(),
  reflection: z.string().max(4000).optional(),
  reflection_lang: z.enum(["en", "zh"]).optional(),
  protein_grams: z.number().min(0).max(500).optional(),
  meals_count: z.number().int().min(0).max(10).optional(),
  snacks_count: z.number().int().min(0).max(10).optional(),
  fluids_ml: z.number().min(0).max(10000).optional(),
  walking_minutes: z.number().min(0).max(720).optional(),
  resistance_training: z.boolean().optional(),
  other_exercise_minutes: z.number().min(0).max(720).optional(),
  meaningful_interactions: z.number().int().min(0).max(50).optional(),
  carer_present: z.boolean().optional(),
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
  baseline_sts_5x_seconds: z.number().min(0).max(120).optional(),
  baseline_tug_seconds: z.number().min(0).max(120).optional(),
  baseline_muac_cm: z.number().min(15).max(50).optional(),
  baseline_calf_cm: z.number().min(20).max(60).optional(),
  locale: z.enum(["en", "zh"]),
  managing_oncologist: z.string().optional(),
  managing_oncologist_phone: z.string().optional(),
  hospital_name: z.string().optional(),
  hospital_phone: z.string().optional(),
  hospital_address: z.string().optional(),
  oncall_phone: z.string().optional(),
  emergency_instructions: z.string().optional(),
  home_city: z.string().optional(),
  home_lat: z.number().optional(),
  home_lon: z.number().optional(),
  home_timezone: z.string().optional(),
  onboarded_at: z.string().optional(),
  last_exported_at: z.string().optional(),
  anthropic_api_key: z.string().optional(),
  default_ai_model: z.string().optional(),
  tracked_symptoms: z.array(z.string()).optional(),
  symptoms_baseline_set_at: z.string().optional(),
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
  sarc_f_responses: z.array(z.number().int().min(0).max(2)).length(5).optional(),
  sarc_f_total: z.number().int().min(0).max(10).optional(),
  tug_seconds: z.number().min(0).max(120).optional(),
  single_leg_stance_seconds: z.number().min(0).max(120).optional(),
  sts_5x_seconds: z.number().min(0).max(120).optional(),
  walk_6min_meters: z.number().min(0).max(1000).optional(),
});

export type FortnightlyAssessmentInput = z.infer<
  typeof fortnightlyAssessmentSchema
>;

export const weeklyAssessmentSchema = z.object({
  week_start: z.string(),
  entered_by: z.enum(["hulin", "catherine", "thomas"]),
  practice_full_days: z.number().int().min(0).max(7),
  practice_reduced_days: z.number().int().min(0).max(7),
  practice_skipped_days: z.number().int().min(0).max(7),
  functional_integrity: z.number().min(1).max(5),
  cognitive_stillness: z.number().min(1).max(5),
  social_practice_integrity: z.number().min(1).max(5),
  energy_trend: z.enum(["improving", "stable", "declining"]).optional(),
  concerns: z.string().max(4000).optional(),
  questions_for_oncologist: z.string().max(4000).optional(),
  week_summary: z.string().max(4000).optional(),
});

export type WeeklyAssessmentInput = z.infer<typeof weeklyAssessmentSchema>;
