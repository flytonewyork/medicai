import type { Appointment } from "./appointment";
import type { LabResult, LifeEvent } from "./clinical";
import type { Medication } from "./medication";
import type { PatientTask } from "./task";
import type { CareTeamMember } from "./care-team";

// Universal-ingest payload shape. The /api/ai/ingest-universal route
// classifies a single input (text / image / pasted email) and returns
// an `IngestDraft`: a list of typed operations that, if applied,
// produce the rows the document implies. The client renders each op
// as a diff card before anything writes to Dexie.
//
// Why typed ops? A clinic letter often implies multiple changes (a
// new appointment + a new clinician contact + a follow-up task). One
// document → many ops. Each op is independently approvable so the
// patient can accept "schedule this scan" and reject "raise the
// chemo dose" if they want.

export type IngestSourceKind = "photo" | "paste" | "pdf" | "email";

export type IngestDocumentKind =
  | "clinic_letter"
  | "appointment_email"
  | "appointment_letter"
  | "lab_report"
  | "imaging_report"
  | "prescription"
  | "discharge_summary"
  | "pre_appointment_instructions"
  | "handwritten_note"
  | "other";

export type IngestOp =
  | { kind: "add_appointment"; data: Partial<Appointment>; reason?: string }
  | {
      kind: "update_appointment";
      // Match by either exact local id (when the model is reading our
      // own data) or by a soft hint the client resolves before apply.
      match: { id?: number; title_contains?: string; on_date?: string };
      changes: Partial<Appointment>;
      reason: string;
    }
  | { kind: "add_lab_result"; data: Partial<LabResult>; reason?: string }
  | { kind: "add_medication"; data: Partial<Medication>; reason?: string }
  | {
      kind: "add_care_team_member";
      data: Partial<CareTeamMember>;
      reason?: string;
    }
  | { kind: "add_task"; data: Partial<PatientTask>; reason?: string }
  | { kind: "add_life_event"; data: Partial<LifeEvent>; reason?: string };

export type IngestOpKind = IngestOp["kind"];

export interface IngestDraft {
  source: IngestSourceKind;
  detected_kind: IngestDocumentKind;
  summary: string; // one-sentence plain-language summary
  ops: IngestOp[];
  ambiguities: string[];
  confidence: "low" | "medium" | "high";
}

// Result of applying one op locally — surfaces the resulting Dexie
// row id so the UI can offer "open this appointment" deep links.
export interface IngestApplyResult {
  op: IngestOp;
  ok: boolean;
  id?: number | string;
  error?: string;
}
