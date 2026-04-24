import { db, now } from "~/lib/db/dexie";
import { addCareTeamMember } from "~/lib/care-team/registry";
import type {
  IngestApplyResult,
  IngestOp,
  LabMatch,
  MedicationMatch,
} from "~/types/ingest";
import type { Appointment } from "~/types/appointment";
import type {
  CtdnaResult,
  Decision,
  Imaging,
  LabResult,
  LifeEvent,
  SourceSystem,
} from "~/types/clinical";
import type { Medication } from "~/types/medication";
import type { PatientTask } from "~/types/task";
import type { TreatmentCycle } from "~/types/treatment";

// Row-level provenance the caller can attach to every row written by an
// IngestDraft. Copied onto each add_* op's data before insert unless the
// op already set its own (which would be unusual — normally the parser
// doesn't know the source_pdf_id, it's assigned when the caller stores
// the blob). update_* ops are NOT tagged: updates describe a change to
// an existing row with its own provenance history, and silently
// overwriting that would lose information.
export interface IngestProvenance {
  source_system?: SourceSystem;
  source_pdf_id?: number;
}

function withProvenance<T extends object>(
  data: T,
  prov?: IngestProvenance,
): T {
  if (!prov || (prov.source_system === undefined && prov.source_pdf_id === undefined)) {
    return data;
  }
  const out = { ...data } as Record<string, unknown>;
  if (prov.source_system !== undefined && out.source_system === undefined) {
    out.source_system = prov.source_system;
  }
  if (prov.source_pdf_id !== undefined && out.source_pdf_id === undefined) {
    out.source_pdf_id = prov.source_pdf_id;
  }
  return out as T;
}

// Dispatcher that turns a typed IngestOp into the right Dexie write.
// Kept as a single exhaustive switch so adding a new op kind requires
// updating exactly one place. Returns the new row id (or null) so the
// UI can render "Open <new appointment>" links after apply.
//
// Updates use a soft-match strategy: prefer an exact local id, fall
// back to title_contains + on_date narrow. If the match resolves to
// nothing (or to multiple rows) we no-op and surface that as an
// `apply` failure rather than silently picking a wrong row.

export async function applyIngestOp(
  op: IngestOp,
  provenance?: IngestProvenance,
): Promise<IngestApplyResult> {
  const ts = now();
  try {
    switch (op.kind) {
      case "add_appointment": {
        const id = (await db.appointments.add({
          ...withProvenance(op.data as Appointment, provenance),
          status: op.data.status ?? "scheduled",
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "update_appointment": {
        const target = await resolveAppointment(op.match);
        if (!target?.id) {
          return {
            op,
            ok: false,
            error: target === null ? "no_match" : "ambiguous_match",
          };
        }
        await db.appointments.update(target.id, {
          ...op.changes,
          updated_at: ts,
        });
        return { op, ok: true, id: target.id };
      }
      case "add_lab_result": {
        // Dedupe by collection date. A multi-page trend printout emits one op
        // per collection date; re-uploading the same report would otherwise
        // build up duplicate rows. When a row for the same `date` already
        // exists and no conflicting analyte values are present, merge new
        // analytes into it rather than adding a new row.
        const incoming = withProvenance(
          op.data as Partial<LabResult>,
          provenance,
        );
        if (incoming.date) {
          const same = await db.labs
            .where("date")
            .equals(incoming.date)
            .toArray();
          const row = same.length === 1 ? same[0] : undefined;
          if (row?.id !== undefined) {
            const rowId = row.id;
            const patch: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(incoming)) {
              if (
                k === "id" ||
                k === "date" ||
                k === "source" ||
                k === "created_at" ||
                k === "updated_at"
              )
                continue;
              if (typeof v !== "number") continue;
              const existing = (row as unknown as Record<string, unknown>)[k];
              if (typeof existing === "number") continue; // keep the first-recorded value on this date
              patch[k] = v;
            }
            if (Object.keys(patch).length === 0) {
              return { op, ok: true, id: rowId };
            }
            await db.labs.update(rowId, { ...patch, updated_at: ts });
            return { op, ok: true, id: rowId };
          }
        }
        const id = (await db.labs.add({
          ...(incoming as LabResult),
          source: incoming.source ?? "external",
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_medication": {
        const id = (await db.medications.add({
          ...withProvenance(op.data as Medication, provenance),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_care_team_member": {
        const data = op.data;
        const id = await addCareTeamMember({
          name: data.name ?? "",
          role: data.role ?? "other",
          specialty: data.specialty,
          organisation: data.organisation,
          phone: data.phone,
          email: data.email,
          notes: data.notes,
          is_lead: data.is_lead ?? false,
        });
        return { op, ok: true, id };
      }
      case "add_task": {
        const id = (await db.patient_tasks.add({
          ...(op.data as PatientTask),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_life_event": {
        const id = (await db.life_events.add({
          ...withProvenance(op.data as LifeEvent, provenance),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "update_lab_result": {
        const target = await resolveLab(op.match);
        if (!target?.id) {
          return {
            op,
            ok: false,
            error: target === null ? "no_match" : "ambiguous_match",
          };
        }
        await db.labs.update(target.id, { ...op.changes, updated_at: ts });
        return { op, ok: true, id: target.id };
      }
      case "add_imaging": {
        const id = (await db.imaging.add({
          ...withProvenance(op.data as Imaging, provenance),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_ctdna_result": {
        const id = (await db.ctdna_results.add({
          ...withProvenance(op.data as CtdnaResult, provenance),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "update_medication": {
        const target = await resolveMedication(op.match);
        if (!target?.id) {
          return {
            op,
            ok: false,
            error: target === null ? "no_match" : "ambiguous_match",
          };
        }
        await db.medications.update(target.id, {
          ...op.changes,
          updated_at: ts,
        });
        return { op, ok: true, id: target.id };
      }
      case "add_treatment_cycle": {
        const id = (await db.treatment_cycles.add({
          ...withProvenance(op.data as TreatmentCycle, provenance),
          status: op.data.status ?? "active",
          dose_level: op.data.dose_level ?? 0,
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_decision": {
        const id = (await db.decisions.add({
          ...withProvenance(op.data as Decision, provenance),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "update_settings": {
        const all = await db.settings.toArray();
        const row = all[0];
        if (!row?.id) {
          return { op, ok: false, error: "no_settings_row" };
        }
        await db.settings.update(row.id, {
          ...op.changes,
          updated_at: ts,
        });
        return { op, ok: true, id: row.id };
      }
    }
  } catch (err) {
    return {
      op,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function resolveAppointment(match: {
  id?: number;
  title_contains?: string;
  on_date?: string;
}): Promise<Appointment | null | undefined> {
  if (typeof match.id === "number") {
    return (await db.appointments.get(match.id)) ?? null;
  }
  const all = await db.appointments.toArray();
  const candidates = all.filter((a) => {
    const titleOk = match.title_contains
      ? a.title.toLowerCase().includes(match.title_contains.toLowerCase())
      : true;
    const dateOk = match.on_date
      ? a.starts_at.startsWith(match.on_date)
      : true;
    return titleOk && dateOk;
  });
  if (candidates.length === 0) return null;
  if (candidates.length > 1) return undefined; // ambiguous
  return candidates[0];
}

async function resolveMedication(
  match: MedicationMatch,
): Promise<Medication | null | undefined> {
  if (typeof match.id === "number") {
    return (await db.medications.get(match.id)) ?? null;
  }
  const all = await db.medications.toArray();
  const candidates = all.filter((m) => {
    const drugOk = match.drug_id ? m.drug_id === match.drug_id : true;
    const nameOk = match.name_contains
      ? (m.drug_id ?? "").toLowerCase().includes(
          match.name_contains.toLowerCase(),
        )
      : true;
    return drugOk && nameOk;
  });
  if (candidates.length === 0) return null;
  if (candidates.length > 1) return undefined;
  return candidates[0];
}

async function resolveLab(
  match: LabMatch,
): Promise<LabResult | null | undefined> {
  if (typeof match.id === "number") {
    return (await db.labs.get(match.id)) ?? null;
  }
  if (!match.on_date) return null;
  const candidates = await db.labs
    .where("date")
    .equals(match.on_date)
    .toArray();
  if (candidates.length === 0) return null;
  if (candidates.length > 1) return undefined;
  return candidates[0];
}

// Apply a list of ops in order. Stops on the first failure when
// `stopOnError` is true; otherwise records each result and continues.
// When `provenance` is supplied (typically from the parent IngestDraft)
// each add_* op's row is tagged with the source_system / source_pdf_id
// before insert.
export async function applyIngestOps(
  ops: readonly IngestOp[],
  options: { stopOnError?: boolean; provenance?: IngestProvenance } = {},
): Promise<IngestApplyResult[]> {
  const out: IngestApplyResult[] = [];
  for (const op of ops) {
    const r = await applyIngestOp(op, options.provenance);
    out.push(r);
    if (options.stopOnError && !r.ok) break;
  }
  return out;
}
