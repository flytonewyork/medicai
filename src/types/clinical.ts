export type EnteredBy = "hulin" | "catherine" | "thomas";
export type Locale = "en" | "zh";
export type Zone = "green" | "yellow" | "orange" | "red";
export type RuleCategory =
  | "function"
  | "toxicity"
  | "disease"
  | "psychological"
  | "nutrition";

export interface DailyEntry {
  id?: number;
  date: string;
  entered_at: string;
  entered_by: EnteredBy;
  energy: number;
  sleep_quality: number;
  appetite: number;
  pain_worst: number;
  pain_current: number;
  mood_clarity: number;
  nausea: number;
  weight_kg?: number;
  steps?: number;
  practice_morning_completed: boolean;
  practice_morning_quality?: number;
  practice_evening_completed: boolean;
  practice_evening_quality?: number;
  cold_dysaesthesia: boolean;
  neuropathy_hands: boolean;
  neuropathy_feet: boolean;
  mouth_sores: boolean;
  diarrhoea_count: number;
  new_bruising: boolean;
  dyspnoea: boolean;
  fever: boolean;
  fever_temp?: number;
  reflection?: string;
  reflection_lang?: Locale;
  created_at: string;
  updated_at: string;
}

export interface WeeklyAssessment {
  id?: number;
  week_start: string;
  entered_at: string;
  entered_by: EnteredBy;
  practice_full_days: number;
  practice_reduced_days: number;
  practice_skipped_days: number;
  functional_integrity: number;
  cognitive_stillness: number;
  social_practice_integrity: number;
  week_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface FortnightlyAssessment {
  id?: number;
  assessment_date: string;
  entered_at: string;
  entered_by: EnteredBy;
  ecog_self: 0 | 1 | 2 | 3 | 4;
  pro_ctcae_fatigue_severity?: number;
  pro_ctcae_fatigue_interference?: number;
  pro_ctcae_neuropathy_severity?: number;
  pro_ctcae_neuropathy_interference?: number;
  pro_ctcae_diarrhoea_frequency?: number;
  pro_ctcae_pain_severity?: number;
  pro_ctcae_pain_interference?: number;
  phq9_total?: number;
  phq9_responses?: number[];
  gad7_total?: number;
  gad7_responses?: number[];
  distress_thermometer?: number;
  grip_dominant_kg?: number;
  grip_nondominant_kg?: number;
  gait_speed_ms?: number;
  sit_to_stand_30s?: number;
  muac_cm?: number;
  calf_circumference_cm?: number;
  tns_total?: number;
  neuropathy_grade?: 0 | 1 | 2 | 3 | 4;
  created_at: string;
  updated_at: string;
}

export interface QuarterlyReview {
  id?: number;
  review_date: string;
  entered_by: EnteredBy;
  imaging_recist_status?: "CR" | "PR" | "SD" | "PD";
  imaging_notes?: string;
  cga_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id?: number;
  date: string;
  ca199?: number;
  albumin?: number;
  prealbumin?: number;
  hemoglobin?: number;
  neutrophils?: number;
  platelets?: number;
  creatinine?: number;
  bilirubin?: number;
  alt?: number;
  ast?: number;
  crp?: number;
  ferritin?: number;
  magnesium?: number;
  phosphate?: number;
  vit_d?: number;
  b12?: number;
  folate?: number;
  source: "epworth" | "external";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Imaging {
  id?: number;
  date: string;
  modality: "CT" | "MRI" | "PET" | "US" | "other";
  findings_summary: string;
  recist_status?: "CR" | "PR" | "SD" | "PD";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CtdnaResult {
  id?: number;
  date: string;
  platform: "signatera" | "natera" | "guardant" | "other";
  value?: number;
  unit?: string;
  detected: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MolecularProfile {
  id?: number;
  germline?: {
    brca1?: "positive" | "negative" | "vus" | "pending";
    brca2?: "positive" | "negative" | "vus" | "pending";
    palb2?: "positive" | "negative" | "vus" | "pending";
    atm?: "positive" | "negative" | "vus" | "pending";
  };
  somatic?: {
    kras?: string;
    nras?: string;
    hras?: string;
    msi?: "MSI-H" | "MSS" | "pending";
    dmmr?: "dMMR" | "pMMR" | "pending";
    braf?: string;
    ntrk?: string;
    nrg1?: string;
  };
  platform?: string;
  tested_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Treatment {
  id?: number;
  cycle_number: number;
  date: string;
  regimen: string;
  dose_gem_mg_m2?: number;
  dose_nab_mg_m2?: number;
  schedule?: "weekly" | "biweekly" | "other";
  modifications?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id?: number;
  name: string;
  dose?: string;
  frequency?: string;
  start_date: string;
  stop_date?: string;
  active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LifeEvent {
  id?: number;
  title: string;
  event_date: string;
  category: "family" | "cultural" | "travel" | "practice" | "medical" | "other";
  notes?: string;
  pre_event_buffer_days?: number;
  post_event_buffer_days?: number;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id?: number;
  decision_date: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives?: string;
  decided_by: string;
  linked_alert_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ZoneAlert {
  id?: number;
  rule_id: string;
  rule_name: string;
  zone: Zone;
  category: RuleCategory;
  triggered_at: string;
  resolved: boolean;
  resolved_at?: string;
  acknowledged: boolean;
  acknowledged_by?: EnteredBy;
  recommendation: string;
  recommendation_zh: string;
  suggested_levers: string[];
  created_at: string;
  updated_at: string;
}

export interface FamilyNote {
  id?: number;
  created_at: string;
  updated_at: string;
  author: EnteredBy;
  body: string;
}

export interface Settings {
  id?: number;
  profile_name: string;
  dob?: string;
  diagnosis_date?: string;
  baseline_weight_kg?: number;
  baseline_date?: string;
  baseline_grip_dominant_kg?: number;
  baseline_grip_nondominant_kg?: number;
  baseline_gait_speed_ms?: number;
  baseline_sit_to_stand?: number;
  locale: Locale;
  managing_oncologist?: string;
  created_at: string;
  updated_at: string;
}
