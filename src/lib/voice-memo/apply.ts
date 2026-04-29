import { db, now } from "~/lib/db/dexie";
import type { DailyEntry, EnteredBy, Imaging, LabResult, LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type {
  AppliedPatch,
  VoiceMemo,
  VoiceMemoParsedFields,
} from "~/types/voice-memo";
import { localDayISO } from "~/lib/utils/date";
import {
  extractNumericValue,
  findAppointmentForClinicVisit,
  findAppointmentForImaging,
  findAppointmentForLab,
  findExistingLabRow,
  mapLabName,
  mapModality,
} from "./match";

// Slice 3: turn a memo's parsed_fields into actual rows in the
// appropriate tables — only when the patient has reviewed and
// confirmed. The memo detail page calls `applyMemoPatches` from a
// "Log to forms" button; the daily-form auto-fill that Slice 2 ran
// silently is gone.
//
// Every write produces an `AppliedPatch` row that's saved back onto
// the memo so the detail view can render an honest audit trail
// ("filled energy=7 on 2026-04-29's daily entry · created 'Cycle 3
// chemo' on 2026-05-02 in appointments").
//
// Personal content is never patched anywhere — it lives on the memo
// for the patient's diary review and stays put.

export interface ApplyOptions {
  // What the patient confirmed in the preview form. Each toggle lets
  // them include or exclude one section of the parse from the apply.
  // Defaults: all true when the patient just hits "Save".
  apply_daily?: boolean;
  apply_clinic_visit?: boolean;
  apply_appointments?: boolean;
  // Subset of the parsed daily values the patient may have edited
  // before applying. Falls back to memo.parsed_fields when omitted.
  daily_overrides?: DailyOverridePatch;
  // Slice 5: per-result toggles for imaging + lab creates. The
  // linking step (mark a matched appointment attended, append the
  // memo's interpretation to its notes) is silent and always runs;
  // creating a NEW imaging or labs row when no appointment matched
  // requires an explicit tap. Index in the array maps 1:1 to the
  // memo's `parsed_fields.imaging_results[]` / `lab_results[]`.
  // When omitted, no new clinical rows are created.
  imaging_create?: boolean[];
  lab_create?: boolean[];
}

export type DailyOverridePatch = Partial<
  Pick<
    DailyEntry,
    | "energy"
    | "sleep_quality"
    | "appetite"
    | "pain_current"
    | "pain_worst"
    | "mood_clarity"
    | "nausea"
    | "fatigue"
    | "anorexia"
    | "abdominal_pain"
    | "neuropathy_hands"
    | "neuropathy_feet"
    | "weight_kg"
    | "diarrhoea_count"
    | "cold_dysaesthesia"
    | "mouth_sores"
    | "fever"
  >
>;

export async function applyMemoPatches(
  memoId: number,
  opts: ApplyOptions = {},
): Promise<AppliedPatch[]> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return [];
  const parsed = memo.parsed_fields;
  if (!parsed) return [];

  const apply_daily = opts.apply_daily ?? true;
  const apply_visit = opts.apply_clinic_visit ?? true;
  const apply_appts = opts.apply_appointments ?? true;

  const patches: AppliedPatch[] = [];

  if (apply_daily) {
    const dailyPatch = await applyDailyFields(memo, parsed, opts.daily_overrides);
    if (dailyPatch) patches.push(dailyPatch);
  }

  if (apply_visit && parsed.clinical?.clinic_visit) {
    const visitPatches = await applyClinicVisit(
      memo,
      parsed.clinical.clinic_visit,
    );
    patches.push(...visitPatches);
  }

  if (apply_appts && parsed.clinical?.appointments_mentioned?.length) {
    for (const appt of parsed.clinical.appointments_mentioned) {
      // Only auto-create when Claude was confident about both date and
      // title. low/medium stays as a memo annotation the patient can
      // confirm by tapping into /schedule manually.
      if (appt.confidence !== "high") continue;
      const apptPatch = await applyAppointment(memo, appt);
      if (apptPatch) patches.push(apptPatch);
    }
  }

  // Slice 5: imaging results. Always try to link to a matching
  // appointment (auto). Only create a new imaging row when the caller
  // opted in via `imaging_create[i]`.
  if (parsed.imaging_results?.length) {
    for (let i = 0; i < parsed.imaging_results.length; i++) {
      const result = parsed.imaging_results[i]!;
      const create = opts.imaging_create?.[i] ?? false;
      const imagingPatches = await applyImagingResult(memo, result, create);
      patches.push(...imagingPatches);
    }
  }

  // Slice 5: lab results. Same rule — link silently to a matched
  // appointment, only create a labs row when there's a numeric value
  // AND the caller opted in.
  if (parsed.lab_results?.length) {
    for (let i = 0; i < parsed.lab_results.length; i++) {
      const result = parsed.lab_results[i]!;
      const create = opts.lab_create?.[i] ?? false;
      const labPatches = await applyLabResult(memo, result, create);
      patches.push(...labPatches);
    }
  }

  if (patches.length === 0) return [];

  // Append to any previously-recorded patches rather than overwriting
  // — the patient may have applied the daily fields earlier and is
  // now applying a clinic visit from the same memo separately.
  const merged = [...(parsed.applied_patches ?? []), ...patches];
  await db.voice_memos.update(memoId, {
    parsed_fields: { ...parsed, applied_patches: merged },
    updated_at: now(),
  });
  return patches;
}

// Build the daily_entries patch using whatever daily fields the parse
// (or the patient's edited override) has set. Empty fields on the
// existing daily row get filled; fields the patient already entered
// on /daily are preserved unless the override explicitly moves them.
async function applyDailyFields(
  memo: VoiceMemo,
  parsed: VoiceMemoParsedFields,
  override?: DailyOverridePatch,
): Promise<AppliedPatch | null> {
  const day = memo.day || localDayISO(memo.recorded_at);
  const ts = now();

  // Source of truth = the patient's preview edits if provided, else
  // whatever Claude returned. We only carry numerics + booleans the
  // daily form actually represents.
  const source: DailyOverridePatch = override ?? extractDailyShape(parsed);

  const existing = await db.daily_entries
    .where("date")
    .equals(day)
    .first();

  if (existing?.id) {
    const patch = buildSafeFillPatch(existing, source);
    if (Object.keys(patch).length === 0) return null;
    // Capture prior values for undo. Safe-fill only writes to
    // undefined keys, so prior_fields will always be all-undefined,
    // but we still record the keys explicitly so undoAppliedPatch
    // can drop them deterministically without a get() round-trip.
    const prior_fields: Record<string, null> = {};
    for (const k of Object.keys(patch)) {
      prior_fields[k] = null;
    }
    await db.daily_entries.update(existing.id, {
      ...patch,
      updated_at: ts,
    });
    return {
      table: "daily_entries",
      row_id: existing.id,
      fields: patchToFieldsRecord(patch),
      prior_fields,
      op: "update",
      applied_at: ts,
    };
  }

  const stub = buildSafeFillPatch({} as Partial<DailyEntry>, source);
  if (Object.keys(stub).length === 0) return null;
  const enteredBy: EnteredBy = memo.entered_by;
  const id = (await db.daily_entries.add({
    ...stub,
    date: day,
    entered_at: ts,
    entered_by: enteredBy,
    created_at: ts,
    updated_at: ts,
  } as DailyEntry)) as number;
  return {
    table: "daily_entries",
    row_id: id,
    fields: patchToFieldsRecord(stub),
    op: "create",
    applied_at: ts,
  };
}

async function applyClinicVisit(
  memo: VoiceMemo,
  visit: NonNullable<NonNullable<VoiceMemoParsedFields["clinical"]>["clinic_visit"]>,
): Promise<AppliedPatch[]> {
  if (!visit.summary) return [];
  const ts = now();
  const event_date = visit.visit_date ?? memo.day ?? localDayISO(memo.recorded_at);
  const patches: AppliedPatch[] = [];

  // Auto-link first: if there's a matching appointment in the
  // window, flip its status to attended and append the memo's
  // summary/key-points to its notes. Source of truth stays on the
  // schedule; the life_events row below becomes the human-readable
  // timeline anchor.
  const matched = await findAppointmentForClinicVisit(
    visit.kind,
    visit.provider ?? undefined,
    event_date,
  );
  if (matched?.id) {
    const linkPatch = await linkAppointment(
      memo,
      matched,
      formatVisitAttribution(visit),
    );
    if (linkPatch) patches.push(linkPatch);
  }

  const titleParts: string[] = [];
  if (visit.kind === "chemo") titleParts.push("Chemo session");
  else if (visit.kind === "scan") titleParts.push("Scan visit");
  else if (visit.kind === "blood_test") titleParts.push("Bloods");
  else if (visit.kind === "procedure") titleParts.push("Procedure");
  else if (visit.kind === "ed") titleParts.push("ED visit");
  else titleParts.push("Clinic visit");
  if (visit.provider) titleParts.push(`— ${visit.provider}`);
  const title = titleParts.join(" ");

  const notesLines: string[] = [visit.summary];
  if (visit.location) notesLines.push(`Location: ${visit.location}`);
  if (visit.key_points?.length) {
    notesLines.push("");
    for (const k of visit.key_points) notesLines.push(`• ${k}`);
  }

  const row: LifeEvent = {
    title,
    event_date,
    category: "medical",
    notes: notesLines.join("\n"),
    author: memo.entered_by,
    created_via: "manual",
    is_memory: false,
    created_at: ts,
    updated_at: ts,
  };
  const id = (await db.life_events.add(row)) as number;

  const fields: Record<string, string> = {
    title,
    event_date,
    category: "medical",
    summary: visit.summary,
  };
  if (visit.kind) fields.kind = visit.kind;
  if (visit.provider) fields.provider = visit.provider;
  if (visit.location) fields.location = visit.location;
  patches.push({
    table: "life_events",
    row_id: id,
    fields,
    op: "create",
    applied_at: ts,
  });

  return patches;
}

function formatVisitAttribution(
  visit: NonNullable<
    NonNullable<VoiceMemoParsedFields["clinical"]>["clinic_visit"]
  >,
): string {
  const lines: string[] = [`From voice memo: ${visit.summary}`];
  if (visit.key_points?.length) {
    for (const k of visit.key_points) lines.push(`• ${k}`);
  }
  return lines.join("\n");
}

async function applyAppointment(
  memo: VoiceMemo,
  appt: NonNullable<
    NonNullable<VoiceMemoParsedFields["clinical"]>["appointments_mentioned"]
  >[number],
): Promise<AppliedPatch | null> {
  if (!appt.starts_at || !appt.title) return null;
  const ts = now();
  const row: Appointment = {
    kind: appt.kind ?? "other",
    title: appt.title,
    starts_at: appt.starts_at,
    location: appt.location ?? undefined,
    doctor: appt.doctor ?? undefined,
    notes: appt.prep ? `Prep: ${appt.prep}` : undefined,
    status: "scheduled",
    created_at: ts,
    updated_at: ts,
  };
  const id = (await db.appointments.add(row)) as number;

  const fields: Record<string, string | number> = {
    title: appt.title,
    starts_at: appt.starts_at,
    kind: row.kind,
  };
  if (appt.location) fields.location = appt.location;
  if (appt.doctor) fields.doctor = appt.doctor;
  if (appt.prep) fields.prep = appt.prep;
  return {
    table: "appointments",
    row_id: id,
    fields,
    op: "create",
    applied_at: ts,
  };
}

// Slice 5: link a memo to an existing appointment. Auto-applied
// silently when a fuzzy match is found. Flips status `scheduled` →
// `attended`, appends a one-line attribution to notes (preserving
// any existing notes), and stamps `source_memo_id` for provenance.
// `prior_fields` records the pre-link state so undo can restore.
async function linkAppointment(
  memo: VoiceMemo,
  appt: Appointment,
  attribution: string,
): Promise<AppliedPatch | null> {
  if (!appt.id) return null;
  const ts = now();
  const priorStatus = appt.status;
  const priorNotes = appt.notes ?? "";
  const newNotes = priorNotes
    ? `${priorNotes}\n\n${attribution}`
    : attribution;

  const flipStatus =
    priorStatus === "scheduled" ? ("attended" as const) : priorStatus;

  await db.appointments.update(appt.id, {
    status: flipStatus,
    notes: newNotes,
    source_memo_id: memo.id,
    updated_at: ts,
  });

  const fields: Record<string, string | number> = {
    status: flipStatus,
    notes_appended: attribution,
  };
  return {
    table: "appointments",
    row_id: appt.id,
    fields,
    prior_fields: {
      status: priorStatus,
      notes: priorNotes,
    },
    op: "update",
    applied_at: ts,
  };
}

// Slice 5: apply an imaging result from a memo. Two-step:
//   1. Try to link to a recent matching appointment (always silent
//      auto-link). Only fires when the apply step finds a match in
//      the 14-day-back / 7-day-forward window.
//   2. When `createNew` is true, also create an imaging row tied to
//      the matched appointment (when present) and the memo. Driven
//      by the patient tapping "Add new scan/test" in the preview.
async function applyImagingResult(
  memo: VoiceMemo,
  result: NonNullable<VoiceMemoParsedFields["imaging_results"]>[number],
  createNew: boolean,
): Promise<AppliedPatch[]> {
  const patches: AppliedPatch[] = [];
  const day = result.date ?? memo.day ?? localDayISO(memo.recorded_at);

  const matched = await findAppointmentForImaging(result.modality, day);
  if (matched?.id) {
    const linkPatch = await linkAppointment(
      memo,
      matched,
      `From voice memo: ${result.modality.toUpperCase()} — ${result.finding_summary} (${result.status}).`,
    );
    if (linkPatch) patches.push(linkPatch);
  }

  if (createNew) {
    const ts = now();
    const row: Imaging = {
      date: day,
      modality: mapModality(result.modality),
      findings_summary: result.finding_summary,
      notes: `Patient interpretation: ${result.status}.`,
      source_memo_id: memo.id,
      source_appointment_id: matched?.id,
      created_at: ts,
      updated_at: ts,
    };
    const id = (await db.imaging.add(row)) as number;
    patches.push({
      table: "imaging",
      row_id: id,
      fields: {
        modality: row.modality,
        findings_summary: row.findings_summary,
        date: row.date,
      },
      op: "create",
      applied_at: ts,
    });
  }
  return patches;
}

// Slice 5: apply a lab result from a memo. Three branches:
//   1. Numeric value + match in known LabResult typed fields →
//      create a new labs row (when createNew=true) with the typed
//      analyte filled and source: "patient_self_report".
//   2. Match against an existing same-day labs row → safe-fill the
//      missing analyte if present (when createNew=true).
//   3. Always — link to the matched bloods appointment (auto).
async function applyLabResult(
  memo: VoiceMemo,
  result: NonNullable<VoiceMemoParsedFields["lab_results"]>[number],
  createNew: boolean,
): Promise<AppliedPatch[]> {
  const patches: AppliedPatch[] = [];
  const day = result.date ?? memo.day ?? localDayISO(memo.recorded_at);

  // Always try to link a matching bloods appointment first — silent.
  const matched = await findAppointmentForLab(day);
  if (matched?.id) {
    const linkPatch = await linkAppointment(
      memo,
      matched,
      `From voice memo: ${result.name} — ${result.value ?? result.status}.`,
    );
    if (linkPatch) patches.push(linkPatch);
  }

  if (!createNew) return patches;

  const numeric = extractNumericValue(result.value);
  const fieldKey = mapLabName(result.name);
  // Without a numeric value mapped to a known typed analyte we don't
  // touch the labs table — the qualitative mention stays on the memo
  // (and on the linked appointment's notes). Per the user's design.
  if (numeric === null || !fieldKey) return patches;

  const ts = now();
  const existing = await findExistingLabRow(day);

  if (existing?.id) {
    // Safe-fill: only write when the analyte slot is empty. Don't
    // overwrite a value Thomas imported from Epworth earlier.
    const existingValue = (existing as unknown as Record<string, unknown>)[
      fieldKey
    ];
    if (typeof existingValue === "number") return patches;
    await db.labs.update(existing.id, {
      [fieldKey]: numeric,
      updated_at: ts,
    });
    patches.push({
      table: "labs",
      row_id: existing.id,
      fields: { [fieldKey]: numeric },
      prior_fields: { [fieldKey]: null },
      op: "update",
      applied_at: ts,
    });
    return patches;
  }

  const row: LabResult = {
    date: day,
    [fieldKey]: numeric,
    source: "patient_self_report",
    source_memo_id: memo.id,
    source_appointment_id: matched?.id,
    created_at: ts,
    updated_at: ts,
  } as LabResult;
  const id = (await db.labs.add(row)) as number;
  patches.push({
    table: "labs",
    row_id: id,
    fields: { date: day, [fieldKey]: numeric, source: "patient_self_report" },
    op: "create",
    applied_at: ts,
  });
  return patches;
}

// Pull just the daily-form shape out of a parsed result. Keeps the
// apply step decoupled from VoiceMemoParsedFields' broader structure.
export function extractDailyShape(
  parsed: VoiceMemoParsedFields,
): DailyOverridePatch {
  const out: DailyOverridePatch = {};
  copyNumber(out, parsed, "energy");
  copyNumber(out, parsed, "sleep_quality");
  copyNumber(out, parsed, "appetite");
  copyNumber(out, parsed, "pain_current");
  copyNumber(out, parsed, "pain_worst");
  copyNumber(out, parsed, "mood_clarity");
  copyNumber(out, parsed, "nausea");
  copyNumber(out, parsed, "fatigue");
  copyNumber(out, parsed, "anorexia");
  copyNumber(out, parsed, "abdominal_pain");
  copyNumber(out, parsed, "neuropathy_hands");
  copyNumber(out, parsed, "neuropathy_feet");
  copyNumber(out, parsed, "weight_kg");
  copyNumber(out, parsed, "diarrhoea_count");
  copyBool(out, parsed, "cold_dysaesthesia");
  copyBool(out, parsed, "mouth_sores");
  copyBool(out, parsed, "fever");
  return out;
}

function copyNumber<K extends keyof DailyOverridePatch>(
  out: DailyOverridePatch,
  parsed: VoiceMemoParsedFields,
  key: K,
): void {
  const v = (parsed as unknown as Record<string, unknown>)[key as string];
  if (typeof v === "number") {
    (out as unknown as Record<string, unknown>)[key as string] = v;
  }
}

function copyBool<K extends keyof DailyOverridePatch>(
  out: DailyOverridePatch,
  parsed: VoiceMemoParsedFields,
  key: K,
): void {
  const v = (parsed as unknown as Record<string, unknown>)[key as string];
  if (typeof v === "boolean") {
    (out as unknown as Record<string, unknown>)[key as string] = v;
  }
}

// Safe-fill rules (preserved from Slice 2): never overwrite a value
// the patient already wrote; booleans only flip undefined → true.
// Exported for unit testing.
export function buildSafeFillPatch(
  existing: Partial<DailyEntry>,
  source: DailyOverridePatch,
): Partial<DailyEntry> {
  const out: Partial<DailyEntry> = {};

  fillNumber(out, existing, source, "energy");
  fillNumber(out, existing, source, "sleep_quality");
  fillNumber(out, existing, source, "appetite");
  fillNumber(out, existing, source, "pain_current");
  fillNumber(out, existing, source, "pain_worst");
  fillNumber(out, existing, source, "mood_clarity");
  fillNumber(out, existing, source, "nausea");
  fillNumber(out, existing, source, "fatigue");
  fillNumber(out, existing, source, "anorexia");
  fillNumber(out, existing, source, "abdominal_pain");
  fillNumber(out, existing, source, "neuropathy_hands");
  fillNumber(out, existing, source, "neuropathy_feet");
  fillNumber(out, existing, source, "weight_kg");
  fillNumber(out, existing, source, "diarrhoea_count");

  flipTrue(out, existing, source, "cold_dysaesthesia");
  flipTrue(out, existing, source, "mouth_sores");
  flipTrue(out, existing, source, "fever");

  return out;
}

function fillNumber<K extends NumericFillKey>(
  out: Partial<DailyEntry>,
  existing: Partial<DailyEntry>,
  source: DailyOverridePatch,
  key: K,
): void {
  const incoming = source[key];
  if (typeof incoming !== "number") return;
  if (typeof existing[key] === "number") return;
  out[key] = incoming;
}

function flipTrue<K extends BoolFillKey>(
  out: Partial<DailyEntry>,
  existing: Partial<DailyEntry>,
  source: DailyOverridePatch,
  key: K,
): void {
  if (source[key] !== true) return;
  if (existing[key] === true) return;
  out[key] = true;
}

function patchToFieldsRecord(
  patch: Partial<DailyEntry>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v === null) {
      out[k] = null;
    }
  }
  return out;
}

type NumericFillKey =
  | "energy"
  | "sleep_quality"
  | "appetite"
  | "pain_current"
  | "pain_worst"
  | "mood_clarity"
  | "nausea"
  | "fatigue"
  | "anorexia"
  | "abdominal_pain"
  | "neuropathy_hands"
  | "neuropathy_feet"
  | "weight_kg"
  | "diarrhoea_count";

type BoolFillKey = "cold_dysaesthesia" | "mouth_sores" | "fever";

// Reverse a single AppliedPatch and mark it `undone_at` on the memo.
// `create` patches simply delete the row; `update` patches restore
// each touched key to its prior value (or remove the key if it had
// no prior value, which is the safe-fill case). The audit row stays
// in place — undone, not deleted — so the patient can see that the
// memo logged then unlogged a value.
export async function undoAppliedPatch(
  memoId: number,
  patchIndex: number,
): Promise<{ ok: boolean; error?: string }> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo?.parsed_fields?.applied_patches) {
    return { ok: false, error: "no patches on memo" };
  }
  const patches = memo.parsed_fields.applied_patches;
  const target = patches[patchIndex];
  if (!target) return { ok: false, error: "patch not found" };
  if (target.undone_at) return { ok: false, error: "patch already undone" };

  const ts = now();
  try {
    if (target.op === "create") {
      await deleteRow(target.table, target.row_id);
    } else {
      await revertUpdate(target);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const next = patches.map((p, i) =>
    i === patchIndex ? { ...p, undone_at: ts } : p,
  );
  await db.voice_memos.update(memoId, {
    parsed_fields: { ...memo.parsed_fields, applied_patches: next },
    updated_at: ts,
  });
  return { ok: true };
}

async function deleteRow(
  table: AppliedPatch["table"],
  id: number,
): Promise<void> {
  if (table === "daily_entries") await db.daily_entries.delete(id);
  else if (table === "life_events") await db.life_events.delete(id);
  else if (table === "appointments") await db.appointments.delete(id);
  else if (table === "imaging") await db.imaging.delete(id);
  else if (table === "labs") await db.labs.delete(id);
}

async function revertUpdate(patch: import("~/types/voice-memo").AppliedPatch): Promise<void> {
  const ts = now();
  // Read the current row, set the touched keys back to their prior
  // values (null in our records means "the key was undefined before"),
  // and put() it back. We don't use Dexie.update({key: undefined})
  // because semantics around dropping keys vs. keeping them as
  // explicit `undefined` aren't portable across Dexie versions.
  const keys = Object.keys(patch.fields);
  if (patch.table === "daily_entries") {
    const row = await db.daily_entries.get(patch.row_id);
    if (!row) return;
    const next = { ...row };
    const prior = patch.prior_fields ?? {};
    for (const k of keys) {
      const restoredValue = prior[k];
      if (restoredValue === null || restoredValue === undefined) {
        delete (next as Record<string, unknown>)[k];
      } else {
        (next as Record<string, unknown>)[k] = restoredValue;
      }
    }
    next.updated_at = ts;
    await db.daily_entries.put(next);
    return;
  }
  if (patch.table === "appointments") {
    // Slice 5: undoing a memo→appointment link restores the prior
    // status (e.g. "scheduled") and notes, and clears the
    // source_memo_id we stamped.
    const row = await db.appointments.get(patch.row_id);
    if (!row) return;
    const prior = patch.prior_fields ?? {};
    const next: Appointment = { ...row, updated_at: ts };
    if (typeof prior.status === "string") {
      next.status = prior.status as Appointment["status"];
    }
    if ("notes" in prior) {
      const v = prior.notes;
      next.notes = typeof v === "string" && v.length > 0 ? v : undefined;
    }
    delete (next as unknown as Record<string, unknown>).source_memo_id;
    await db.appointments.put(next);
    return;
  }
  if (patch.table === "labs") {
    const row = await db.labs.get(patch.row_id);
    if (!row) return;
    const next = { ...row, updated_at: ts } as LabResult;
    const prior = patch.prior_fields ?? {};
    const nextRecord = next as unknown as Record<string, unknown>;
    for (const k of keys) {
      const restoredValue = prior[k];
      if (restoredValue === null || restoredValue === undefined) {
        delete nextRecord[k];
      } else {
        nextRecord[k] = restoredValue;
      }
    }
    await db.labs.put(next);
    return;
  }
  // life_events and appointments don't currently emit `update` patches
  // (we always create rows for them), but keep the branch typed so a
  // future widening doesn't silently no-op.
}
