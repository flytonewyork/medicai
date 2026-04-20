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
});

export type DailyEntryInput = z.infer<typeof dailyEntrySchema>;

export const settingsSchema = z.object({
  profile_name: z.string().min(1),
  dob: z.string().optional(),
  diagnosis_date: z.string().optional(),
  baseline_weight_kg: z.number().min(20).max(200).optional(),
  baseline_date: z.string().optional(),
  baseline_grip_dominant_kg: z.number().min(0).max(100).optional(),
  baseline_grip_nondominant_kg: z.number().min(0).max(100).optional(),
  baseline_gait_speed_ms: z.number().min(0).max(3).optional(),
  baseline_sit_to_stand: z.number().int().min(0).max(50).optional(),
  locale: z.enum(["en", "zh"]),
  managing_oncologist: z.string().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
