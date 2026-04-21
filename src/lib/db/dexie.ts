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
  Medication,
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
  life_events!: Table<LifeEvent, number>;
  decisions!: Table<Decision, number>;
  zone_alerts!: Table<ZoneAlert, number>;
  family_notes!: Table<FamilyNote, number>;
  settings!: Table<Settings, number>;
  pending_results!: Table<PendingResult, number>;
  ingested_documents!: Table<IngestedDocument, number>;
  comprehensive_assessments!: Table<ComprehensiveAssessment, number>;

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
  }
}

export const db = new AnchorDB();

export function now(): string {
  return new Date().toISOString();
}
