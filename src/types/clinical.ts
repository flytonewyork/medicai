export type EnteredBy = "hulin" | "catherine" | "thomas" | "clinician" | "jonalyn";
export type Role = "patient" | "caregiver" | "clinician";
export type Locale = "en" | "zh";
export type Zone = "green" | "yellow" | "orange" | "red";

// Origin of an imported clinical row. "mhr" = My Health Record PDF pulled
// via myGov; "epworth" = Epworth portal / emailed report; "email" = other
// clinical mail (path lab, private scan centre); "photo" = a photograph of
// a paper report; "other" = anything else (CDA XML, copy-paste).
//
// Stored on the row itself so filtering ("show me only MHR-sourced labs")
// and conflict resolution ("two CA 19-9 results same day, different
// sources") do not require a join to pdf_blobs.
export type SourceSystem = "mhr" | "epworth" | "email" | "photo" | "other";

// Original PDF (or CDA XML) that a clinical row was extracted from.
// Stored once in its own table so multiple rows extracted from the same
// document can share a single copy and the "view original" affordance on
// feed items works offline. Blob bytes never leave the device.
export interface PdfBlob {
  id?: number;
  filename: string;
  mime_type: string;       // "application/pdf", "application/xml", image/*
  size_bytes: number;
  sha256?: string;         // optional dedup key; computed at import time
  blob: Blob;              // the original bytes
  source_system: SourceSystem;
  // When the patient captured / uploaded the document, not the clinical
  // date of the content (that lives on the extracted row).
  captured_at: string;
  // Freeform note the patient added at capture ("scan from Tuesday").
  note?: string;
  created_at: string;
  updated_at: string;
}
export type RuleCategory =
  | "function"
  | "toxicity"
  | "disease"
  | "psychological"
  | "nutrition";

// Every clinical field is optional — the daily picker wizard records
// only the categories the patient actually touched. Consumers that used
// to assume presence (detectors, trend nudges, dashboard cards) now
// treat undefined as "not entered today" rather than "zero / absent".
export interface DailyEntry {
  id?: number;
  date: string;
  entered_at: string;
  entered_by: EnteredBy;
  // Slice C: when the user was signed in at save time, this carries
  // their auth.uid so <Attribution /> can render the real profile
  // display_name + avatar. Legacy rows without it fall back to the
  // `entered_by` string label. Optional because not every device has
  // an authenticated session (dad's phone, offline use).
  entered_by_user_id?: string;
  energy?: number;
  sleep_quality?: number;
  appetite?: number;
  pain_worst?: number;
  pain_current?: number;
  mood_clarity?: number;
  nausea?: number;
  weight_kg?: number;
  steps?: number;
  practice_morning_completed?: boolean;
  practice_morning_quality?: number;
  practice_evening_completed?: boolean;
  practice_evening_quality?: number;
  cold_dysaesthesia?: boolean;
  neuropathy_hands?: number;   // CTCAE 0–4 (was boolean; older rows coerce via Number())
  neuropathy_feet?: number;    // CTCAE 0–4
  mouth_sores?: boolean;
  diarrhoea_count?: number;
  new_bruising?: boolean;
  dyspnoea?: boolean;
  fever?: boolean;
  fever_temp?: number;
  // Curated mPDAC/ GnP symptom additions — tracked when the user has
  // them enabled in settings.tracked_symptoms. Semantics:
  //   fatigue, anorexia, abdominal_pain — 0–10 severity
  //   taste_changes — 0–5 (0 normal, 5 food tastes wrong)
  //   steatorrhoea — boolean (flags possible PERT under-dosing)
  fatigue?: number;
  anorexia?: number;
  abdominal_pain?: number;
  taste_changes?: number;
  // JPCC p. 16 quadrants: which way is taste off? Optional —
  // captured only when `taste_changes` is non-zero. Drives the
  // taste-tweak suggester and the food-picker filter.
  taste_issue?:
    | "too_sweet"
    | "too_salty"
    | "too_bland"
    | "metallic"
    | "normal";
  // JPCC p. 14 / 17: additional symptoms with their own playbook.
  // Both optional booleans — captured only on days where the patient
  // ticks the corresponding chip on the daily wizard. No Dexie
  // schema bump needed (not indexed); legacy rows load with these
  // as undefined.
  dry_mouth?: boolean;
  early_satiety?: boolean;
  steatorrhoea?: boolean;
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
  // External-axis inputs (slice 3). Daily count of meaningful human
  // interactions — in-person visits, phone calls, video calls that lasted
  // long enough to matter. Deliberately patient-subjective, not raw call
  // count, so it tracks social connectedness rather than phone activity.
  meaningful_interactions?: number;
  // True if a family member / carer was physically present for part of the
  // day. A simpler binary that catches carer-absence drift independent of
  // total-contacts count.
  carer_present?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyAssessment {
  id?: number;
  week_start: string;
  entered_at: string;
  entered_by: EnteredBy;
  entered_by_user_id?: string;
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
  entered_by_user_id?: string;
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
  // Tumour marker
  ca199?: number;
  cea?: number;
  ldh?: number;
  // Nutrition / inflammation
  albumin?: number;
  prealbumin?: number;
  crp?: number;
  // Haematology
  hemoglobin?: number;
  hematocrit?: number;
  wbc?: number;
  neutrophils?: number;
  lymphocytes?: number;
  platelets?: number;
  // Liver panel (LFTs)
  alt?: number;
  ast?: number;
  ggt?: number;
  alp?: number;
  bilirubin?: number;
  // Renal / electrolytes
  creatinine?: number;
  urea?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  magnesium?: number;
  phosphate?: number;
  // Metabolic
  glucose?: number;
  hba1c?: number;
  // Micronutrients
  ferritin?: number;
  vit_d?: number;
  b12?: number;
  folate?: number;
  // Coag / endocrine
  inr?: number;
  tsh?: number;
  source: "epworth" | "external" | "patient_self_report";
  notes?: string;
  // Provenance — see SourceSystem / PdfBlob above.
  source_system?: SourceSystem;
  source_pdf_id?: number;
  // Slice 5: voice-memo provenance. When the patient quoted a lab
  // value in a memo, source_memo_id ties the labs row back to the
  // recording; source_appointment_id ties it to the bloods
  // appointment that produced the value. Both non-indexed → no
  // Dexie schema bump needed.
  source_memo_id?: number;
  source_appointment_id?: number;
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
  source_system?: SourceSystem;
  source_pdf_id?: number;
  // Slice 5: same voice-memo provenance pair as LabResult above.
  source_memo_id?: number;
  source_appointment_id?: number;
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
  source_system?: SourceSystem;
  source_pdf_id?: number;
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
  source_system?: SourceSystem;
  source_pdf_id?: number;
  created_at: string;
  updated_at: string;
}

// NOTE: Medication and MedicationEvent moved to ~/types/medication for the
// logging-integrated module. This re-export keeps existing consumers working.
export type { Medication, MedicationEvent } from "./medication";

// Persisted change-signal row — a ChangeSignal (from ~/lib/state/detectors)
// that was surfaced and recorded for dedup, status tracking, and later
// outcome attribution. The signal payload lives serialised so the detector
// output is immutable for audit; consumers JSON-parse on read.
export interface ChangeSignalRow {
  id?: number;
  detector: string;
  fired_for: string;
  metric_id: string;
  axis: "individual" | "external" | "tumour" | "drug";
  severity: "caution" | "warning";
  shape: string;
  status: "open" | "acknowledged" | "dismissed" | "resolved";
  payload_json: string;
  detected_at: string;
  resolved_at?: string;
  note?: string;
}

// Every lifecycle transition of a signal + every action the user takes in
// response is written here. The table exists so slice 4's attribution layer
// can reason about "was this signal's resolution preceded by any of the
// suggested actions?" — the loop the app is ultimately built around.
export type SignalEventKind =
  | "emitted"           // detector first fired, ChangeSignalRow created
  | "acknowledged"      // user tapped "Got it"
  | "dismissed"         // user tapped "Dismiss"
  | "action_taken"      // user marked a suggested action done
  | "resolved_auto"     // detector.hasResolved returned true
  | "resolved_manual"   // user marked the signal resolved
  | "reopened";         // detector re-fired after a prior resolution

export interface SignalEventRow {
  id?: number;
  signal_id: number;                // fk → change_signals.id
  kind: SignalEventKind;
  // For kind=action_taken — which SuggestedAction was marked done.
  action_ref_id?: string;
  action_kind?: string;             // "lever" | "task" | "question" | ...
  note?: string;
  created_at: string;
}

// External-axis: log of care-team touchpoints (clinician calls, clinic
// visits, community nurse, allied health). Powers the clinician-gap
// detector and lets the patient see their support-network activity over
// time. Distinct from PatientTask (which is prospective / scheduling) —
// this is retrospective / what actually happened.
export type CareTeamContactKind =
  | "clinic_visit"         // in-person visit with the oncologist / team
  | "clinician_call"       // phone / telehealth with oncology team
  | "specialist_visit"     // non-oncology specialist (HPB surgeon, etc.)
  | "community_nurse"      // home or community nursing contact
  | "allied_health"        // dietitian, physio, psychology, etc.
  | "hospital_admission"   // inpatient stay
  | "emergency_department"
  | "pharmacist"
  | "other";

export interface CareTeamContact {
  id?: number;
  date: string;                      // ISO date
  kind: CareTeamContactKind;
  with_who?: string;                 // clinician / service name
  duration_min?: number;
  notes?: string;
  follow_up_needed?: boolean;
  follow_up_by?: string;             // ISO date for next action
  created_at: string;
  updated_at: string;
}

export interface LifeEvent {
  id?: number;
  title: string;
  event_date: string;
  category: "family" | "cultural" | "travel" | "practice" | "medical" | "diary" | "other";
  notes?: string;
  pre_event_buffer_days?: number;
  post_event_buffer_days?: number;
  source_system?: SourceSystem;
  source_pdf_id?: number;
  // Timeline / legacy fields (v16). Additive — existing rows default to
  // manual-created non-memory events authored by the household's primary
  // record-keeper.
  author?: EnteredBy;
  created_via?: "manual" | "auto_appointment" | "import";
  is_memory?: boolean;                 // diary entry vs tracked planning event
  source_appointment_id?: number;      // set when created_via = auto_appointment
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
  source_system?: SourceSystem;
  source_pdf_id?: number;
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
  // Optional threading onto a timeline anchor (v16). A note can hang off a
  // life event (family moment) or an appointment (clinical milestone), so
  // the timeline view can render it as a reply under that anchor.
  life_event_id?: number;
  appointment_id?: number;
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
  baseline_sit_to_stand?: number;     // 30-second sit-to-stand count
  baseline_sts_5x_seconds?: number;   // 5× sit-to-stand time (seconds)
  baseline_tug_seconds?: number;      // Timed Up-and-Go (seconds)
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
  home_city?: string;
  home_lat?: number;
  home_lon?: number;
  home_timezone?: string;
  onboarded_at?: string;
  last_exported_at?: string;
  anthropic_api_key?: string;
  default_ai_model?: string;
  // Who is using this install: the patient themselves, a family member /
  // caregiver, or a clinician on the team. Set during onboarding; gates the
  // care-team invite flow and the default attribution for manual entries.
  user_type?: "patient" | "caregiver" | "clinician";
  // Which symptom ids (from SYMPTOM_CATALOG) the daily-check-in surfaces.
  // Undefined falls back to defaultTrackedSymptomIds() — the top-10
  // GnP-and-mPDAC-default list.
  tracked_symptoms?: string[];
  // Date the patient first completed a full check-in covering all
  // tracked symptoms — later changes are read against this row as
  // "baseline vs current" when generating trend nudges / reports.
  symptoms_baseline_set_at?: string;
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
