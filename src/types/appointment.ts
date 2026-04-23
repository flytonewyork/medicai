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
  // Set the first time the patient (or Thomas) logs what happened after
  // the appointment — what was discussed at clinic, how chemo went, etc.
  // Drives the follow-up task engine: appointments with no
  // `followup_logged_at` and a past `starts_at` emit a "log what
  // happened" task; setting this dismisses the task.
  followup_logged_at?: string;
  created_at: string;
  updated_at: string;
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
