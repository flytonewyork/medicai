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
} from "~/types/clinical";
import type { Medication } from "~/types/medication";
import type { PatientTask } from "~/types/task";
import type { TreatmentCycle } from "~/types/treatment";

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
): Promise<IngestApplyResult> {
  const ts = now();
  try {
    switch (op.kind) {
      case "add_appointment": {
        const id = (await db.appointments.add({
          ...(op.data as Appointment),
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
        const id = (await db.labs.add({
          ...(op.data as LabResult),
          source: op.data.source ?? "external",
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_medication": {
        const id = (await db.medications.add({
          ...(op.data as Medication),
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
          ...(op.data as LifeEvent),
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
          ...(op.data as Imaging),
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_ctdna_result": {
        const id = (await db.ctdna_results.add({
          ...(op.data as CtdnaResult),
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
          ...(op.data as TreatmentCycle),
          status: op.data.status ?? "active",
          dose_level: op.data.dose_level ?? 0,
          created_at: ts,
          updated_at: ts,
        })) as number;
        return { op, ok: true, id };
      }
      case "add_decision": {
        const id = (await db.decisions.add({
          ...(op.data as Decision),
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
export async function applyIngestOps(
  ops: readonly IngestOp[],
  options: { stopOnError?: boolean } = {},
): Promise<IngestApplyResult[]> {
  const out: IngestApplyResult[] = [];
  for (const op of ops) {
    const r = await applyIngestOp(op);
    out.push(r);
    if (options.stopOnError && !r.ok) break;
  }
  return out;
}
