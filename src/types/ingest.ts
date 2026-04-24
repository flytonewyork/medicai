import type { Appointment } from "./appointment";
import type {
  CtdnaResult,
  Decision,
  Imaging,
  LabResult,
  LifeEvent,
  Settings,
  SourceSystem,
} from "./clinical";
import type { Medication } from "./medication";
import type { PatientTask } from "./task";
import type { CareTeamMember } from "./care-team";
import type { TreatmentCycle } from "./treatment";

// Universal-ingest payload shape. The /api/ai/ingest-universal route
// classifies a single input (text / image / pasted email) and returns
// an `IngestDraft`: a list of typed operations that, if applied,
// produce the rows the document implies. The client renders each op
// as a diff card before anything writes to Dexie.
//
// Every domain module the app understands has at least one ingest
// op. The set is exhaustive on the discriminated union so the
// dispatcher catches missing handlers at compile time.

export type IngestSourceKind = "photo" | "paste" | "pdf" | "email";

export type IngestDocumentKind =
  | "clinic_letter"
  | "appointment_email"
  | "appointment_letter"
  | "lab_report"
  | "imaging_report"
  | "ctdna_report"
  | "prescription"
  | "discharge_summary"
  | "pre_appointment_instructions"
  | "phone_call_note"
  | "treatment_protocol"
  | "decision_record"
  | "handwritten_note"
  | "other";

// Match descriptors used by `update_*` ops so the dispatcher can find
// an existing row when no exact id is provided.
export interface AppointmentMatch {
  id?: number;
  title_contains?: string;
  on_date?: string;
}
export interface MedicationMatch {
  id?: number;
  drug_id?: string;
  name_contains?: string;
}
export interface LabMatch {
  id?: number;
  on_date: string;
}

export type IngestOp =
  | { kind: "add_appointment"; data: Partial<Appointment>; reason?: string }
  | {
      kind: "update_appointment";
      match: AppointmentMatch;
      changes: Partial<Appointment>;
      reason: string;
    }
  | { kind: "add_lab_result"; data: Partial<LabResult>; reason?: string }
  | {
      kind: "update_lab_result";
      match: LabMatch;
      changes: Partial<LabResult>;
      reason: string;
    }
  | { kind: "add_imaging"; data: Partial<Imaging>; reason?: string }
  | { kind: "add_ctdna_result"; data: Partial<CtdnaResult>; reason?: string }
  | { kind: "add_medication"; data: Partial<Medication>; reason?: string }
  | {
      kind: "update_medication";
      match: MedicationMatch;
      changes: Partial<Medication>;
      reason: string;
    }
  | {
      kind: "add_care_team_member";
      data: Partial<CareTeamMember>;
      reason?: string;
    }
  | { kind: "add_task"; data: Partial<PatientTask>; reason?: string }
  | { kind: "add_life_event"; data: Partial<LifeEvent>; reason?: string }
  | {
      kind: "add_treatment_cycle";
      data: Partial<TreatmentCycle>;
      reason?: string;
    }
  | { kind: "add_decision"; data: Partial<Decision>; reason?: string }
  | {
      // Limited settings updates — only the lead-clinician + hospital
      // contact subset, the only fields a clinic letter ever
      // legitimately implies. Never touches baselines or onboarded_at
      // from a parsed document.
      kind: "update_settings";
      changes: Partial<
        Pick<
          Settings,
          | "managing_oncologist"
          | "managing_oncologist_phone"
          | "hospital_name"
          | "hospital_phone"
          | "hospital_address"
          | "oncall_phone"
          | "emergency_instructions"
        >
      >;
      reason: string;
    };

export type IngestOpKind = IngestOp["kind"];

export interface IngestDraft {
  source: IngestSourceKind;
  detected_kind: IngestDocumentKind;
  summary: string; // one-sentence plain-language summary
  ops: IngestOp[];
  ambiguities: string[];
  confidence: "low" | "medium" | "high";
  // Origin of the input document — MHR PDF, Epworth portal, emailed
  // report, camera photo, etc. Optional because most ops still come
  // from pasted text with no recoverable provenance. When set, the
  // dispatcher in operations.ts copies it onto every row the draft
  // writes.
  source_system?: SourceSystem;
  // Foreign key into pdf_blobs for the original file (when one was
  // captured and stored). The dispatcher copies this onto every row
  // so "view original" affordances can resolve back to the source
  // regardless of which table the row lives in.
  source_pdf_id?: number;
}

// Result of applying one op locally — surfaces the resulting Dexie
// row id so the UI can offer "open this appointment" deep links.
export interface IngestApplyResult {
  op: IngestOp;
  ok: boolean;
  id?: number | string;
  error?: string;
}
