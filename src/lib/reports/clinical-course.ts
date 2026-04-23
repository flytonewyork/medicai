import { db } from "~/lib/db/dexie";
import type {
  CtdnaResult,
  Decision,
  Imaging,
  LabResult,
  MolecularProfile,
  Settings,
} from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type { TreatmentCycle } from "~/types/treatment";

// Pure aggregator that builds the structured payload the
// clinical-course summariser reads. Collects every "load-bearing"
// clinical event Anchor stores — biopsy / molecular / decisions /
// cycles / dose changes / scans / ctDNA / CA19-9 timeline / clinic
// letters — and returns it as a compact JSON doc the LLM can chew
// through in one pass.
//
// Also emits a plain-text "timeline" view that the page can render
// directly even when the AI narrative isn't available (offline,
// key missing) — so the report is at minimum a print-and-hand-over
// document without any AI call.

export interface ClinicalCourseKeyDate {
  date: string;
  label: string;
  kind: "diagnosis" | "biopsy" | "decision" | "cycle_start" | "scan" | "ctdna" | "appointment" | "other";
  detail?: string;
}

export interface ClinicalCoursePayload {
  patient: {
    name: string;
    dob?: string;
    diagnosis_date?: string;
    managing_oncologist?: string;
  };
  molecular?: Partial<MolecularProfile>;
  // Cycles, newest first, with any dose modifications captured.
  cycles: Array<
    Pick<
      TreatmentCycle,
      | "cycle_number"
      | "start_date"
      | "planned_end_date"
      | "actual_end_date"
      | "status"
      | "dose_level"
      | "dose_modification_notes"
      | "protocol_id"
      | "notes"
    >
  >;
  // Key decisions (MDT, enrol-in-trial, line change, comfort care).
  decisions: Array<
    Pick<
      Decision,
      "decision_date" | "title" | "decision" | "rationale" | "alternatives" | "decided_by"
    >
  >;
  // Scans with RECIST where available.
  imaging: Array<
    Pick<Imaging, "date" | "modality" | "findings_summary" | "recist_status" | "notes">
  >;
  // ctDNA trajectory.
  ctdna: Array<
    Pick<CtdnaResult, "date" | "platform" | "detected" | "value" | "unit" | "notes">
  >;
  // CA19-9 timeline (most common tumour-marker trend read).
  ca199_trend: Array<{ date: string; value: number }>;
  // The last 6 lab panels in full — the summariser decides what to
  // cite. Older data is aggregated as the trend above.
  recent_labs: Array<LabResult>;
  // Clinic / chemo / scan / biopsy appointments in the window.
  appointments: Array<
    Pick<
      Appointment,
      | "kind"
      | "title"
      | "starts_at"
      | "status"
      | "doctor"
      | "location"
      | "notes"
      | "followup_logged_at"
    >
  >;
  // Auto-assembled keyline for the fallback (and for the prompt's
  // "ground truth" frame).
  timeline: ClinicalCourseKeyDate[];
  generated_at: string;
}

export async function buildClinicalCoursePayload(args?: {
  now?: Date;
  labWindowDays?: number;
}): Promise<ClinicalCoursePayload> {
  const now = args?.now ?? new Date();

  const [
    settingsRows,
    molecularRows,
    cyclesAll,
    decisionsAll,
    imagingAll,
    ctdnaAll,
    labsAll,
    appointmentsAll,
  ] = await Promise.all([
    db.settings.toArray(),
    db.molecular_profile.toArray(),
    db.treatment_cycles.toArray(),
    db.decisions.toArray(),
    db.imaging.toArray(),
    db.ctdna_results.toArray(),
    db.labs.toArray(),
    db.appointments.toArray(),
  ]);

  const settings: Partial<Settings> = settingsRows[0] ?? {};
  const molecular = molecularRows[0];

  const cycles = [...cyclesAll]
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
    .map((c) => ({
      cycle_number: c.cycle_number,
      start_date: c.start_date,
      planned_end_date: c.planned_end_date,
      actual_end_date: c.actual_end_date,
      status: c.status,
      dose_level: c.dose_level,
      dose_modification_notes: c.dose_modification_notes,
      protocol_id: c.protocol_id,
      notes: c.notes,
    }));

  const decisions = [...decisionsAll]
    .sort((a, b) => (a.decision_date < b.decision_date ? 1 : -1))
    .map((d) => ({
      decision_date: d.decision_date,
      title: d.title,
      decision: d.decision,
      rationale: d.rationale,
      alternatives: d.alternatives,
      decided_by: d.decided_by,
    }));

  const imaging = [...imagingAll]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((i) => ({
      date: i.date,
      modality: i.modality,
      findings_summary: i.findings_summary,
      recist_status: i.recist_status,
      notes: i.notes,
    }));

  const ctdna = [...ctdnaAll]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((c) => ({
      date: c.date,
      platform: c.platform,
      detected: c.detected,
      value: c.value,
      unit: c.unit,
      notes: c.notes,
    }));

  // CA19-9 trajectory (ascending date for plotting).
  const ca199_trend = [...labsAll]
    .filter((l) => typeof l.ca199 === "number")
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((l) => ({ date: l.date, value: l.ca199 as number }));

  // Last 6 full panels.
  const recent_labs = [...labsAll]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  const windowDays = args?.labWindowDays ?? 365;
  const windowCutoff = new Date(now);
  windowCutoff.setDate(windowCutoff.getDate() - windowDays);
  const appointments = [...appointmentsAll]
    .filter((a) => new Date(a.starts_at).getTime() >= windowCutoff.getTime())
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1))
    .map((a) => ({
      kind: a.kind,
      title: a.title,
      starts_at: a.starts_at,
      status: a.status,
      doctor: a.doctor,
      location: a.location,
      notes: a.notes,
      followup_logged_at: a.followup_logged_at,
    }));

  return {
    patient: {
      name: settings.profile_name ?? "Patient",
      dob: settings.dob,
      diagnosis_date: settings.diagnosis_date,
      managing_oncologist: settings.managing_oncologist,
    },
    molecular,
    cycles,
    decisions,
    imaging,
    ctdna,
    ca199_trend,
    recent_labs,
    appointments,
    timeline: buildTimeline({
      diagnosis_date: settings.diagnosis_date,
      cycles,
      decisions,
      imaging,
      ctdna,
      appointments,
    }),
    generated_at: now.toISOString(),
  };
}

export function buildTimeline(args: {
  diagnosis_date?: string;
  cycles: ClinicalCoursePayload["cycles"];
  decisions: ClinicalCoursePayload["decisions"];
  imaging: ClinicalCoursePayload["imaging"];
  ctdna: ClinicalCoursePayload["ctdna"];
  appointments: ClinicalCoursePayload["appointments"];
}): ClinicalCourseKeyDate[] {
  const out: ClinicalCourseKeyDate[] = [];
  if (args.diagnosis_date) {
    out.push({
      date: args.diagnosis_date,
      label: "Diagnosis",
      kind: "diagnosis",
    });
  }
  for (const appt of args.appointments) {
    if (appt.kind === "procedure" && /biopsy/i.test(appt.title)) {
      out.push({
        date: appt.starts_at.slice(0, 10),
        label: appt.title,
        kind: "biopsy",
        detail: appt.doctor,
      });
    }
  }
  for (const c of args.cycles) {
    out.push({
      date: c.start_date,
      label: `Cycle ${c.cycle_number} start`,
      kind: "cycle_start",
      detail: c.dose_modification_notes ?? undefined,
    });
  }
  for (const d of args.decisions) {
    out.push({
      date: d.decision_date,
      label: d.title,
      kind: "decision",
      detail: d.decision,
    });
  }
  for (const i of args.imaging) {
    out.push({
      date: i.date,
      label: `${i.modality} ${i.recist_status ?? ""}`.trim(),
      kind: "scan",
      detail: i.findings_summary,
    });
  }
  for (const c of args.ctdna) {
    out.push({
      date: c.date,
      label: `ctDNA (${c.platform ?? "?"}) ${
        c.detected ? "detected" : "undetected"
      }${typeof c.value === "number" ? ` · ${c.value}${c.unit ?? ""}` : ""}`,
      kind: "ctdna",
    });
  }

  // Ascending order → easy to render as a top-to-bottom timeline.
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
