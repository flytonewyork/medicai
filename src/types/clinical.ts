export type EnteredBy = "hulin" | "catherine" | "thomas" | "clinician" | "jonalyn";
export type Role = "patient" | "caregiver" | "clinician";
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
  protein_grams?: number;
  meals_count?: number;
  snacks_count?: number;
  fluids_ml?: number;
  walking_minutes?: number;
  resistance_training?: boolean;
  other_exercise_minutes?: number;
  height_cm?: number;
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
  energy_trend?: "improving" | "stable" | "declining";
  concerns?: string;
  questions_for_oncologist?: string;
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
  sarc_f_responses?: number[];
  sarc_f_total?: number;
  tug_seconds?: number;
  single_leg_stance_seconds?: number;
  sts_5x_seconds?: number;
  walk_6min_meters?: number;
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
  baseline_muac_cm?: number;
  baseline_calf_cm?: number;
  height_cm?: number;
  locale: Locale;
  managing_oncologist?: string;
  managing_oncologist_phone?: string;
  hospital_name?: string;
  hospital_phone?: string;
  hospital_address?: string;
  oncall_phone?: string;
  emergency_instructions?: string;
  onboarded_at?: string;
  anthropic_api_key?: string;
  default_ai_model?: string;
  created_at: string;
  updated_at: string;
}

export type PendingResultCategory =
  | "imaging"
  | "lab"
  | "ctdna"
  | "ngs"
  | "referral"
  | "other";

export interface PendingResult {
  id?: number;
  test_name: string;
  category: PendingResultCategory;
  ordered_date: string;
  expected_by?: string;
  ordered_by?: string;
  site?: string;
  notes?: string;
  received: boolean;
  received_date?: string;
  linked_result_table?: "labs" | "imaging" | "ctdna_results";
  linked_result_id?: number;
  created_at: string;
  updated_at: string;
}

export type ComprehensiveAssessmentStatus = "draft" | "complete";

export type ComprehensiveAssessmentTrigger =
  | "baseline"
  | "quarterly"
  | "pre_imaging"
  | "ad_hoc";

export interface PillarScores {
  functional_score: number;
  symptom_score: number;
  toxicity_score: number;
  mental_score: number;
  spiritual_score: number;
  anchor_index: number;
}

export interface ComprehensiveAssessment {
  id?: number;
  assessment_date: string;
  started_at: string;
  completed_at?: string;
  status: ComprehensiveAssessmentStatus;
  trigger: ComprehensiveAssessmentTrigger;
  entered_by: EnteredBy;

  // Anthropometrics
  weight_kg?: number;
  height_cm?: number;
  muac_cm?: number;
  calf_cm?: number;
  waist_cm?: number;

  // Vitals (optional)
  resting_hr?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  spo2?: number;

  // Functional
  ecog_self?: 0 | 1 | 2 | 3 | 4;
  grip_dominant_kg?: number;
  grip_nondominant_kg?: number;
  gait_speed_ms?: number;
  sit_to_stand_30s?: number;
  sts_5x_seconds?: number;
  tug_seconds?: number;
  single_leg_stance_seconds?: number;
  walk_6min_meters?: number;
  sarc_f_responses?: number[];
  sarc_f_total?: number;

  // Symptoms
  pain_worst?: number;
  pain_current?: number;
  pain_interference?: number;
  pain_location?: string;
  pain_character?: string;
  fatigue_severity?: number;
  fatigue_interference?: number;
  appetite_rating?: number;
  nausea_severity?: number;
  vomiting_frequency?: number;
  diarrhoea_frequency?: number;
  constipation_severity?: number;
  jaundice?: boolean;
  pruritus_severity?: number;
  dyspnoea_severity?: number;
  cough_severity?: number;
  fever_recent?: boolean;
  night_sweats?: boolean;
  weight_loss_unintentional?: boolean;

  // Toxicity
  neuropathy_grade_overall?: 0 | 1 | 2 | 3 | 4;
  neuropathy_hands_grade?: 0 | 1 | 2 | 3 | 4;
  neuropathy_feet_grade?: 0 | 1 | 2 | 3 | 4;
  cold_dysaesthesia_severity?: number;
  mucositis_severity?: number;
  skin_changes?: boolean;
  nail_changes?: boolean;
  easy_bruising?: boolean;
  cognitive_concern?: number;

  // Mental
  phq9_responses?: number[];
  phq9_total?: number;
  gad7_responses?: number[];
  gad7_total?: number;
  distress_thermometer?: number;
  sleep_quality?: number;
  sleep_hours_average?: number;

  // Spiritual (FACIT-Sp-12 shortened)
  facitsp_responses?: number[];
  facitsp_meaning_peace?: number;
  facitsp_faith?: number;
  facitsp_total?: number;
  values_statement?: string;
  practice_days_past_week?: number;

  // Free-text reflection
  overall_reflection?: string;

  // Computed scores
  functional_score?: number;
  symptom_score?: number;
  toxicity_score?: number;
  mental_score?: number;
  spiritual_score?: number;
  anchor_index?: number;

  // AI summary
  ai_summary_patient?: string;
  ai_summary_clinician?: string;
  ai_summary_model?: string;

  tests_included?: string[];
  tests_completed?: string[];
  tests_skipped?: string[];

  created_at: string;
  updated_at: string;
}

export type IngestedDocumentKind =
  | "lab_report"
  | "imaging_report"
  | "ctdna_report"
  | "referral"
  | "clinic_letter"
  | "other";

export type IngestedDocumentStatus =
  | "ocr_pending"
  | "ocr_complete"
  | "extracted"
  | "saved"
  | "error";

export interface IngestedDocument {
  id?: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: IngestedDocumentKind;
  uploaded_at: string;
  ocr_text?: string;
  ocr_confidence?: number;
  extraction_method?: "heuristic" | "claude";
  extraction_model?: string;
  extracted_payload?: Record<string, unknown>;
  status: IngestedDocumentStatus;
  error_message?: string;
  linked_result_table?: "labs" | "imaging" | "ctdna_results";
  linked_result_id?: number;
  source_document_date?: string;
  created_at: string;
  updated_at: string;
}
