import { db, now } from "~/lib/db/dexie";
import type { DailyEntry, EnteredBy, LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type {
  AppliedPatch,
  VoiceMemo,
  VoiceMemoParsedFields,
} from "~/types/voice-memo";
import { localDayISO } from "~/lib/utils/date";

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
  // Defaults: all true when the patient just hits "Log to forms".
  apply_daily?: boolean;
  apply_clinic_visit?: boolean;
  apply_appointments?: boolean;
  // Subset of the parsed daily values the patient may have edited
  // before applying. Falls back to memo.parsed_fields when omitted.
  daily_overrides?: DailyOverridePatch;
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
    const visitPatch = await applyClinicVisit(memo, parsed.clinical.clinic_visit);
    if (visitPatch) patches.push(visitPatch);
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
    await db.daily_entries.update(existing.id, {
      ...patch,
      updated_at: ts,
    });
    return {
      table: "daily_entries",
      row_id: existing.id,
      fields: patchToFieldsRecord(patch),
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
): Promise<AppliedPatch | null> {
  if (!visit.summary) return null;
  const ts = now();
  const event_date = visit.visit_date ?? memo.day ?? localDayISO(memo.recorded_at);
  const titleParts: string[] = [];
  if (visit.provider) titleParts.push(`Visit — ${visit.provider}`);
  else titleParts.push("Clinic visit");
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
  if (visit.provider) fields.provider = visit.provider;
  if (visit.location) fields.location = visit.location;
  return {
    table: "life_events",
    row_id: id,
    fields,
    op: "create",
    applied_at: ts,
  };
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
