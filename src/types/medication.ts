import type { LocalizedText } from "./treatment";

// Re-export so the medication module is self-contained for consumers.
export type { LocalizedText } from "./treatment";

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

export interface DrugReference {
  title: string;
  url: string;
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
  // Notes for the profile page, free-form bilingual paragraph.
  clinical_note?: LocalizedText;
}

export interface DrugInteraction {
  pair: [string, string]; // [drug_id_a, drug_id_b], sorted
  severity: "info" | "caution" | "warning";
  effect: LocalizedText;
  management: LocalizedText;
}

// ---- Runtime persistence shapes (step 2 will write these) ------------------

export interface MedicationRecord {
  id?: number;
  drug_id: string;
  display_name?: string;
  category: MedicationCategory;
  dose: string;
  route: MedicationRoute;
  schedule: DoseSchedule;
  active: boolean;
  notes?: string;
  started_on: string;
  stopped_on?: string;
  created_at: string;
  updated_at: string;
}

export interface DoseLogEntry {
  id?: number;
  medication_id: number;
  scheduled_at?: string;
  logged_at: string;
  taken: boolean;
  dose_taken?: string;
  note?: string;
  source: "check_in" | "quick_log" | "backfill";
}
