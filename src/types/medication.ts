import type { LocalizedText } from "./treatment";

// Re-export so the medication module is self-contained for consumers.
export type { LocalizedText };

export type MedicationRoute =
  | "PO"
  | "IV"
  | "SC"
  | "IM"
  | "topical"
  | "PR"
  | "inhaled"
  | "sublingual"
  | "transdermal"
  | "practice"; // behavioural interventions (qigong, meditation)

export type MedicationCategory =
  | "chemo"
  | "targeted"
  | "immunotherapy"
  | "antiemetic"
  | "steroid"
  | "pert"
  | "neuropathy"
  | "anticoagulant"
  | "gcsf"
  | "analgesic"
  | "sleep"
  | "mental"
  | "gi"
  | "appetite"
  | "supplement"
  | "behavioural"
  | "other";

export type ScheduleKind =
  | "fixed"
  | "with_meals"
  | "prn"
  | "cycle_linked"
  | "taper"
  | "custom";

export interface TaperStep {
  dose: string;
  duration_days: number;
}

export interface DoseSchedule {
  kind: ScheduleKind;
  // kind = "fixed" | "with_meals"
  times_per_day?: number;
  clock_times?: string[]; // ["08:00", "20:00"]
  // kind = "cycle_linked"
  cycle_days?: number[];
  hold_on_infusion_day?: boolean;
  // kind = "taper"
  taper_steps?: TaperStep[];
  // kind = "custom"
  rrule?: string;
  // all kinds
  start_date?: string;
  end_date?: string;
  label?: LocalizedText; // optional human-readable summary
}

export interface DietInteraction {
  food: LocalizedText;
  effect: LocalizedText;
  severity: "info" | "caution" | "warning";
}

export interface DrugSideEffects {
  common: LocalizedText[];
  serious: LocalizedText[];
}

// Provenance levels, ordered roughly from most to least authoritative.
export type ReferenceSource =
  | "FDA_label"          // accessdata.fda.gov / dailymed.nlm.nih.gov
  | "TGA_PI"             // tga.gov.au product information
  | "EMA_SmPC"           // EMA Summary of Product Characteristics
  | "guideline"          // ASCO / NCCN / ESMO / MASCC / NCI
  | "trial_protocol"     // ClinicalTrials.gov record / sponsor protocol
  | "trial_publication"  // peer-reviewed primary trial paper
  | "company_disclosure" // sponsor investor or pipeline material
  | "review";            // narrative or systematic review

export interface DrugReference {
  source: ReferenceSource;
  title: string;
  url: string;
  accessed: string;        // ISO date the URL was fetched
  publisher?: string;      // e.g. "FDA", "TGA", "Amplia Therapeutics"
  section?: string;        // e.g. "Section 2.2 Recommended Dose"
}

// A value paired with its citations. `source_refs` are indices into
// DrugInfo.references — keep them sorted ascending for stable diffs.
export interface CitedValue<T> {
  value: T;
  source_refs: number[];
}

export interface LftCheckFact {
  baseline: boolean;       // check at baseline before first dose
  cycle_days: number[];    // monitoring days within each cycle
  rationale: LocalizedText;
}

export interface SteroidCrashFact {
  start_day_post_dose: number; // typically 3
  end_day_post_dose: number;   // typically 5
  rationale: LocalizedText;
}

export interface NadirFact {
  start_day: number;       // cycle day window starts
  end_day: number;         // cycle day window ends
  counts: ("ANC" | "platelets" | "Hb")[];
  rationale: LocalizedText;
}

// Structured, citation-backed clinical facts the prompt rule engine reads.
// All fields optional — only populate facts that have been verified against
// a real reference. Never invent values here.
export interface PromptFacts {
  lft_check?: CitedValue<LftCheckFact>;
  steroid_crash?: CitedValue<SteroidCrashFact>;
  nadir?: CitedValue<NadirFact>;
}

export interface DrugInfo {
  id: string;
  name: LocalizedText;
  aliases: string[];
  category: MedicationCategory;
  default_route: MedicationRoute;
  mpdac_relevant: boolean;
  drug_class: LocalizedText;
  mechanism: LocalizedText;
  typical_doses: LocalizedText[]; // a few common adult dose examples
  default_schedules: DoseSchedule[];
  side_effects: DrugSideEffects;
  monitoring: LocalizedText[];
  diet_interactions: DietInteraction[];
  protocol_ids?: string[]; // optional join to Protocol.id
  supportive_id?: string;  // optional join to treatment-levers
  references?: DrugReference[];
  // Structured facts for the prompt rule engine. Only populated for drugs
  // whose facts have been cited against entries in `references`.
  prompt_facts?: PromptFacts;
  // Notes for the profile page, free-form bilingual paragraph.
  clinical_note?: LocalizedText;
}

export interface DrugInteraction {
  pair: [string, string]; // [drug_id_a, drug_id_b], sorted
  severity: "info" | "caution" | "warning";
  effect: LocalizedText;
  management: LocalizedText;
}

// ---- Runtime persistence shapes --------------------------------------------

// Source of the medication in the patient's active list.
// - "protocol_agent"  — chemo agent auto-derived from the active cycle's protocol
// - "protocol_supportive" — typical_supportive from the protocol (auto-derived)
// - "user_added"     — patient or carer added manually (e.g. PRN symptomatic)
export type MedicationSource =
  | "protocol_agent"
  | "protocol_supportive"
  | "user_added";

export interface Medication {
  id?: number;
  drug_id: string;            // joins to DRUG_REGISTRY; "custom:<slug>" for freeform
  display_name?: string;      // override when drug_id is custom or user wants a tag
  category: MedicationCategory;
  dose: string;               // e.g. "400 mg", "1000 mg/m²"
  route: MedicationRoute;
  schedule: DoseSchedule;
  source: MedicationSource;
  cycle_id?: number;          // for protocol-derived meds, link to TreatmentCycle.id
  active: boolean;
  notes?: string;
  started_on: string;         // ISO date
  stopped_on?: string;
  created_at: string;
  updated_at: string;
}

// A single logged dose (taken, skipped, or side-effect observation).
export interface MedicationEvent {
  id?: number;
  medication_id: number;
  drug_id: string;            // denormalized for queries without joins
  event_type: "taken" | "missed" | "side_effect_only";
  logged_at: string;          // ISO timestamp
  scheduled_at?: string;      // if the med had a scheduled time
  dose_taken?: string;        // override of schedule dose
  // Side-effect flags observed at or near this log
  side_effects?: string[];    // e.g. ["nausea", "fatigue", "diarrhea"]
  side_effect_severity?: 1 | 2 | 3 | 4 | 5; // 1=mild, 5=severe (patient self-report)
  note?: string;
  source: "daily_checkin" | "quick_log" | "fab" | "backfill";
  created_at: string;
}

// Persisted record of a context-aware medication prompt the engine has
// surfaced to the patient. One row per (rule, fired_for) pair so we can
// dedupe across renders and correlate later (2b.2+).
export interface MedicationPromptEvent {
  id?: number;
  rule_id: string;            // e.g. "narmafotinib_d22_lft"
  fired_for: string;          // dedupe key, e.g. "cycle:7|day:22"
  drug_id?: string;           // primary drug the prompt is about
  cycle_id?: number;
  cycle_day?: number;
  status: "shown" | "acknowledged" | "dismissed";
  shown_at: string;           // ISO
  resolved_at?: string;       // ISO when status moved off "shown"
  note?: string;              // patient-entered free text on ack
}

// Convenience: "what's due / what was logged today" for a single medication.
export interface MedicationTodayStatus {
  medication: Medication;
  drug_name_en: string;
  drug_name_zh: string;
  due_count: number;          // expected doses today from schedule
  logged_count: number;       // actual dose events today
  last_logged_at?: string;
  is_due_now: boolean;        // within the next scheduled-time window
  next_due_at?: string;       // ISO timestamp of the next scheduled dose today
}
