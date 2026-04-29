import type { SourceSystem } from "./clinical";

// Scheduling + appointments module.
//
// An Appointment is any anticipated medical event the patient needs to
// prepare for, attend, and (usually) have follow-up captures from. We
// model it one step richer than `life_events` so we can:
//  - render it as a first-class tile in /schedule
//  - chain prep dependencies (blood test must happen N days before chemo)
//  - auto-derive patient_tasks from the dependency graph
//  - attach photos / notes / result captures per event over its lifecycle
//
// Past appointments stay in this table — attended + completed — rather
// than migrating to life_events. The tabular record is the source of
// truth; life_events is for narrative entries the patient made directly.

export type AppointmentKind =
  | "clinic"        // oncology / specialist consult
  | "chemo"         // infusion visit
  | "scan"          // CT / MRI / PET
  | "blood_test"    // pathology / phlebotomy
  | "procedure"     // line/port/biopsy/etc.
  | "other";        // allied health, GP, trial visit, etc.

export type AppointmentStatus =
  | "scheduled"
  | "attended"
  | "missed"
  | "cancelled"
  | "rescheduled";

// Slice F: structured attendance. Sits alongside the freetext
// `attendees` list. A name in `attendees` with no matching
// `attendance` entry renders as pending; members flip themselves
// between confirmed / tentative / declined / (back to pending) with
// one tap. Keyed by name (case-insensitive) so renames in the
// care-team registry don't break old rows; `user_id` is the auth uid
// when the claim came from a signed-in member.
export type AttendanceStatus = "confirmed" | "tentative" | "declined";

export interface AppointmentAttendance {
  name: string;
  user_id?: string;
  status: AttendanceStatus;
  claimed_at: string;
  note?: string;
}

// Slice I: structured preparation instructions. A clinic phone call
// often lands several time-sensitive requirements — "6-hour fast
// starts at 1 AM, hold metformin from tonight, arrive 30 minutes
// early, bring photo ID" — that the patient needs to check off like
// a pre-flight list. The typed array surfaces as a Preparation
// section on the appointment detail page and drives the dashboard's
// "fasting now" banner.
export type AppointmentPrepKind =
  | "fast"              // no food/drink for N hours before
  | "medication_hold"   // stop a med ahead of the procedure
  | "medication_take"   // do take something ("drink the contrast")
  | "arrive_early"      // be there N minutes before start
  | "bring"             // bring ID, referral, scans, etc.
  | "sample"            // provide a sample (urine, stool) on the day
  | "transport"         // can't drive after (sedation etc.)
  | "companion"         // needs an accompanying adult
  | "consent"           // consent form to sign beforehand
  | "pre_scan_contrast" // oral / IV contrast pre-scan
  | "other";

export type AppointmentPrepSource =
  | "email"
  | "phone"
  | "letter"
  | "in_person"
  | "other";

export interface AppointmentPrep {
  kind: AppointmentPrepKind;
  description: string;
  // Time-sensitive prep carries either an absolute start time
  // (e.g. fast starts at 2026-04-24T01:00:00+10:00) OR a relative
  // "N hours before appointment" hint that the UI resolves at read.
  starts_at?: string;
  hours_before?: number;
  // Set when the patient (or Thomas) ticks the item off on the
  // detail page — used to colour completed items and to compute
  // whether an active fast/prep window is currently in effect.
  completed_at?: string;
  // Where the instruction came from. Captured so Thomas can trace
  // "who told us this?" — especially important for items delivered
  // over the phone with no written source.
  info_source?: AppointmentPrepSource;
}

export interface Appointment {
  id?: number;
  kind: AppointmentKind;
  title: string;                 // "Cycle 3 consult with Dr Lee"
  starts_at: string;             // ISO 8601 timestamp
  ends_at?: string;              // optional; for whole-day leave blank
  all_day?: boolean;
  timezone?: string;             // IANA; defaults to device
  location?: string;             // "Epworth Richmond, level 4"
  location_url?: string;         // Google Maps link etc.
  doctor?: string;               // "Dr Michael Lee"
  phone?: string;
  notes?: string;                // markdown
  status: AppointmentStatus;
  // Free-text attendee list — "who was invited".
  attendees?: string[];
  // Structured "who's actually going" — one row per member that has
  // claimed a status. Name-keyed, case-insensitive on read.
  attendance?: AppointmentAttendance[];
  // Photo / document references (keys into ingested_documents, or bare
  // data URLs for small captures).
  attachments?: string[];
  // When true, this row was auto-generated from a treatment_cycle
  // (e.g. "Cycle 3 Day 1 infusion") and may be overwritten on cycle
  // edit. Manual edits set this to false so we stop clobbering them.
  derived_from_cycle?: boolean;
  cycle_id?: number;
  // Slice K: richer cross-module linkage. An appointment can point
  // at any domain record it relates to — a chemo appointment linked
  // to its treatment cycle, a blood-test appointment linked to the
  // pending lab panel, a scan linked (after the fact) to the imaging
  // report that came back. Distinct from `cycle_id` above which
  // stays as a first-class FK for fast-path queries (the
  // [cycle_id+starts_at] Dexie index).
  linked_records?: AppointmentLinkedRecord[];
  // When this appointment came from an ICS / iCloud subscription,
  // the source identifier so re-imports can dedupe + update rather
  // than creating duplicates.
  ics_uid?: string;
  // Structured preparation items (see AppointmentPrep).
  prep?: AppointmentPrep[];
  // Explicit flag for appointments where the patient knows prep will
  // be needed but hasn't received the details yet (e.g. "chemo is
  // Wednesday but the office will email the prep details later").
  // Drives a derived awaiting-info task on the schedule.
  prep_info_received?: boolean;
  // Set the first time the patient (or Thomas) logs what happened after
  // the appointment — what was discussed at clinic, how chemo went, etc.
  // Drives the follow-up task engine: appointments with no
  // `followup_logged_at` and a past `starts_at` emit a "log what
  // happened" task; setting this dismisses the task.
  followup_logged_at?: string;
  // Ad-hoc items to raise at this visit — populated by the /log direct-
  // file flow (e.g. "blood sugar 7.9 fasting") and by the patient / carer
  // manually. Each entry is a short plain-language line; optional `source`
  // lets the UI surface provenance ("from Tue's glucose log").
  discussion_items?: AppointmentDiscussionItem[];
  // Provenance when this row came from an imported document (clinic letter,
  // MHR appointment PDF). See SourceSystem / PdfBlob in ~/types/clinical.
  source_system?: SourceSystem;
  source_pdf_id?: number;
  // Slice 5: voice-memo provenance. When a memo was matched to this
  // appointment (e.g. dad reporting on a PET CT result for a
  // previously-scheduled scan), the most recent memo id that linked
  // here. Future linkings can use linked_records[] for full history.
  source_memo_id?: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentDiscussionItem {
  id: string;                     // local uuid-ish, just a client slug
  text: string;                   // e.g. "Fasting glucose 7.9 on 5 May"
  source?: "log" | "direct_file" | "manual" | "agent";
  source_ref?: string;            // e.g. labs:123, daily_entries:45
  added_at: string;               // ISO
  resolved_at?: string;           // tick-off on the detail page
}

// Slice K: cross-module links from an appointment to any domain row
// (treatment cycle, lab result, imaging report, ctDNA result, the
// pending-result placeholder, medication, decision). Kept typed so
// the UI renders the right icon + link per kind and readers can
// cheaply filter without union-unwrapping.
export type AppointmentLinkedRecordKind =
  | "treatment_cycle"
  | "lab_result"
  | "pending_result"
  | "imaging"
  | "ctdna_result"
  | "medication"
  | "decision"
  | "task";

export interface AppointmentLinkedRecord {
  kind: AppointmentLinkedRecordKind;
  local_id: number;
  // Short note on why the link exists ("Cycle 4 infusion",
  // "ordered CA19-9 + FBE") — shown in the UI next to the chip.
  label?: string;
}

// Directed edge. Today the only relation that matters clinically is
// "prep_for" ("this blood test is prep for that chemo consult"), but
// leaving the relation typed means we can later add "follow_up_of",
// "rescheduled_from", "blocks", etc. without schema churn.
export type AppointmentLinkRelation = "prep_for" | "follow_up_of";

export interface AppointmentLink {
  id?: number;
  from_id: number;   // the blood test
  to_id: number;     // the chemo consult the blood test is prep for
  relation: AppointmentLinkRelation;
  // Optional offset hint — "blood test due 1 day before chemo". Used
  // by the task engine to back-fill a patient_task with a sensible
  // due_date if `from_id` has no starts_at of its own yet.
  offset_days?: number;
  notes?: string;
  created_at: string;
}
