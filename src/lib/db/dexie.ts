import Dexie, { type Table } from "dexie";
import type {
  DailyEntry,
  WeeklyAssessment,
  FortnightlyAssessment,
  QuarterlyReview,
  LabResult,
  Imaging,
  CtdnaResult,
  MolecularProfile,
  Treatment,
  LifeEvent,
  Decision,
  ZoneAlert,
  FamilyNote,
  Settings,
  PendingResult,
  IngestedDocument,
  ComprehensiveAssessment,
} from "~/types/clinical";
import type { Trial } from "~/types/bridge";
import type { TreatmentCycle } from "~/types/treatment";
import type { PatientTask } from "~/types/task";
import type {
  Medication,
  MedicationEvent,
  MedicationPromptEvent,
} from "~/types/medication";

export class AnchorDB extends Dexie {
  daily_entries!: Table<DailyEntry, number>;
  weekly_assessments!: Table<WeeklyAssessment, number>;
  fortnightly_assessments!: Table<FortnightlyAssessment, number>;
  quarterly_reviews!: Table<QuarterlyReview, number>;
  labs!: Table<LabResult, number>;
  imaging!: Table<Imaging, number>;
  ctdna_results!: Table<CtdnaResult, number>;
  molecular_profile!: Table<MolecularProfile, number>;
  trials!: Table<Trial, number>;
  treatments!: Table<Treatment, number>;
  medications!: Table<Medication, number>;
  medication_events!: Table<MedicationEvent, number>;
  medication_prompt_events!: Table<MedicationPromptEvent, number>;
  life_events!: Table<LifeEvent, number>;
  decisions!: Table<Decision, number>;
  zone_alerts!: Table<ZoneAlert, number>;
  family_notes!: Table<FamilyNote, number>;
  settings!: Table<Settings, number>;
  pending_results!: Table<PendingResult, number>;
  ingested_documents!: Table<IngestedDocument, number>;
  comprehensive_assessments!: Table<ComprehensiveAssessment, number>;
  treatment_cycles!: Table<TreatmentCycle, number>;
  patient_tasks!: Table<PatientTask, number>;

  constructor() {
    super("anchor_db");
    this.version(1).stores({
      daily_entries: "++id, date, entered_by",
      weekly_assessments: "++id, week_start",
      fortnightly_assessments: "++id, assessment_date",
      quarterly_reviews: "++id, review_date",
      labs: "++id, date",
      imaging: "++id, date",
      ctdna_results: "++id, date",
      molecular_profile: "++id",
      trials: "++id, trial_id, status, priority",
      treatments: "++id, cycle_number, date",
      medications: "++id, start_date",
      life_events: "++id, event_date",
      decisions: "++id, decision_date",
      zone_alerts: "++id, triggered_at, rule_id, zone",
      family_notes: "++id, created_at",
      settings: "++id",
    });
    this.version(2).stores({
      pending_results: "++id, ordered_date, category, expected_by",
      ingested_documents: "++id, uploaded_at, status, kind",
    });
    this.version(3).stores({
      comprehensive_assessments:
        "++id, assessment_date, status, trigger, started_at",
    });
    this.version(4).stores({
      treatment_cycles:
        "++id, start_date, status, protocol_id, cycle_number",
    });
    this.version(5).stores({
      patient_tasks:
        "++id, due_date, active, category, schedule_kind, preset_id",
    });
    // v6: reshape medications table for logging-integrated module + add events.
    // The v1 medications table was unused; safe to redefine indexes.
    this.version(6).stores({
      medications:
        "++id, drug_id, category, active, cycle_id, source, started_on",
      medication_events:
        "++id, medication_id, drug_id, event_type, logged_at, [drug_id+logged_at]",
    });
    // v7: context-aware medication prompts (2b.1). The compound
    // [rule_id+fired_for] index dedupes a prompt within its trigger window so
    // the dashboard card never re-shows an acknowledged or dismissed prompt.
    this.version(7).stores({
      medication_prompt_events:
        "++id, rule_id, status, shown_at, drug_id, cycle_id, [rule_id+fired_for]",
    });
  }
}

export const db = new AnchorDB();

export function now(): string {
  return new Date().toISOString();
}
