import Dexie, { type Table } from "dexie";
import type {
  ChangeSignalRow,
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
  SignalEventRow,
} from "~/types/clinical";
import type { Trial } from "~/types/bridge";
import type { TreatmentCycle } from "~/types/treatment";
import type { PatientTask } from "~/types/task";
import type { CareTeamMember } from "~/types/care-team";
import type {
  Medication,
  MedicationEvent,
  MedicationPromptEvent,
} from "~/types/medication";
import type {
  AgentFeedbackRow,
  AgentRunRow,
  AgentStateRow,
  LogEventRow,
} from "~/types/agent";
import type { Appointment, AppointmentLink } from "~/types/appointment";

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
  change_signals!: Table<ChangeSignalRow, number>;
  signal_events!: Table<SignalEventRow, number>;
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
  agent_states!: Table<AgentStateRow, number>;
  log_events!: Table<LogEventRow, number>;
  agent_runs!: Table<AgentRunRow, number>;
  agent_feedback!: Table<AgentFeedbackRow, number>;
  appointments!: Table<Appointment, number>;
  appointment_links!: Table<AppointmentLink, number>;
  care_team!: Table<CareTeamMember, number>;

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
    // v8: change-signal detector outputs (slice 2). `fired_for` is the dedup
    // key per detector occurrence; `status` drives lifecycle (open →
    // acknowledged / dismissed / resolved). The compound [detector+fired_for]
    // index enforces uniqueness per occurrence.
    this.version(8).stores({
      change_signals:
        "++id, detector, fired_for, metric_id, axis, severity, status, detected_at, [detector+fired_for]",
    });
    // v9: per-signal event log for outcome attribution (slice 4). One row
    // per lifecycle transition or user-logged action. Index on signal_id so
    // the attribution helper can walk events for a given signal cheaply.
    this.version(9).stores({
      signal_events:
        "++id, signal_id, kind, action_ref_id, created_at, [signal_id+created_at]",
    });
    // v10: multi-agent super-brain (Sprint 2). The patient's "log" surface
    // writes to `log_events` directly (no per-log Claude call). Once daily
    // (or on-demand), each specialist runs over its referrals: the run
    // produces an `agent_runs` row with the daily report, and the
    // specialist's `agent_states` row is rewritten in place.
    // - agent_states: unique per agent_id, holds the living state.md
    // - log_events: raw inputs; sliced by tag at batch time
    // - agent_runs: one row per invocation, indexed for "latest report"
    this.version(10).stores({
      agent_states: "++id, &agent_id, updated_at",
      log_events: "++id, at",
      agent_runs: "++id, agent_id, ran_at, [agent_id+ran_at]",
    });
    // v11: dial-in loop. Per-run human feedback (Thomas, patient,
    // clinician). The next agent run reads the most recent feedback for
    // its agent_id and includes it as a cached system block, so the
    // agent can adjust tone, calibration, or scope.
    this.version(11).stores({
      agent_feedback:
        "++id, agent_id, run_id, by, kind, at, [agent_id+at]",
    });
    // v12: scheduling module. `appointments` is first-class for any
    // anticipated medical event; `appointment_links` is a directed
    // edge table so a blood test can be flagged as "prep_for" a chemo
    // consult. Indexes on starts_at / kind make range queries (month
    // grid, next-week) + kind-filter cheap. Compound
    // [kind+starts_at] lets "next scan" pull fast.
    this.version(12).stores({
      appointments:
        "++id, starts_at, kind, status, cycle_id, [kind+starts_at]",
      appointment_links:
        "++id, from_id, to_id, relation, [to_id+relation]",
    });
    // v13: care-team registry. One row per person involved in the
    // patient's care (family, clinicians, allied health). Consumed by
    // the appointment attendee chip picker, the emergency card, and
    // the pre-clinic summary. Indexed on role + is_lead so the
    // "primary oncologist" / "primary family contact" lookups are
    // cheap.
    this.version(13).stores({
      care_team: "++id, role, is_lead, name",
    });
  }
}

export const db = new AnchorDB();

export function now(): string {
  return new Date().toISOString();
}
