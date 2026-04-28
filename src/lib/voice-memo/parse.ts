import { db, now } from "~/lib/db/dexie";
import { localDayISO } from "~/lib/utils/date";
import { postJson } from "~/lib/utils/http";
import type { DailyEntry, EnteredBy } from "~/types/clinical";
import type { VoiceMemo, VoiceMemoParsedFields } from "~/types/voice-memo";

// Slice 2: Claude-powered structured extraction. After Whisper hands
// us a transcript, we ask Claude to pull out daily-tracking fields
// (energy, sleep, pain, neuropathy, etc.) and merge them into the
// day's `daily_entries` row as a safe fill — never an overwrite.
//
// Why "safe fill"? The daily form is the source of truth when the
// patient (or carer) explicitly fills it. Voice memos are a
// supplementary stream; if the patient already wrote energy=7 on the
// form, a memo saying "felt sluggish" shouldn't silently rewrite that
// to a 4. Empty fields get filled; populated fields are preserved.
//
// `parsed_fields` always lands on the memo regardless of confidence
// so the diary card can show what Claude heard. Only `high`-
// confidence numeric fields ever flow into `daily_entries`.

interface ParseResponse {
  parsed: VoiceMemoParsedFields;
}

// Run the full parse-and-apply pipeline for one memo. Errors don't
// throw into the UI — they're logged and the memo stays unparsed,
// which the diary surfaces as a re-parse affordance later.
export async function parseAndApplyVoiceMemo(memoId: number): Promise<void> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return;
  if (memo.parsed_fields) return; // already parsed
  if (!memo.transcript.trim()) return;

  let parsed: VoiceMemoParsedFields;
  try {
    const res = await postJson<ParseResponse>("/api/ai/parse-voice-memo", {
      transcript: memo.transcript,
      locale: memo.locale,
      recorded_at: memo.recorded_at,
    });
    parsed = res.parsed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[voice-memo] parse failed", memoId, err);
    return;
  }

  await db.voice_memos.update(memoId, {
    parsed_fields: parsed,
    updated_at: now(),
  });

  if (parsed.confidence === "high") {
    await applyParsedFieldsToDaily(memo, parsed);
  }
}

// Merge a parsed memo into its day's daily_entries row using
// fill-empty-only semantics. Booleans only flip true; numerics only
// fill when the daily field is undefined; `notes` accumulates so
// multiple memos in a day don't clobber each other.
export async function applyParsedFieldsToDaily(
  memo: VoiceMemo,
  parsed: VoiceMemoParsedFields,
): Promise<void> {
  const day = memo.day || localDayISO(memo.recorded_at);
  const existing = await db.daily_entries
    .where("date")
    .equals(day)
    .first();
  const ts = now();

  if (existing?.id) {
    const patch = buildSafeFillPatch(existing, parsed);
    if (Object.keys(patch).length === 0) return;
    await db.daily_entries.update(existing.id, {
      ...patch,
      updated_at: ts,
    });
    return;
  }

  // No daily row yet — create a stub with whatever the memo provided.
  const stub = buildSafeFillPatch({} as Partial<DailyEntry>, parsed);
  if (Object.keys(stub).length === 0) return;
  const enteredBy: EnteredBy = memo.entered_by;
  await db.daily_entries.add({
    ...stub,
    date: day,
    entered_at: ts,
    entered_by: enteredBy,
    created_at: ts,
    updated_at: ts,
  } as DailyEntry);
}

// Decide which keys move from the parsed result into the daily row
// without trampling existing data. Exported for unit testing — the
// merge rules are the part most worth pinning down.
export function buildSafeFillPatch(
  existing: Partial<DailyEntry>,
  parsed: VoiceMemoParsedFields,
): Partial<DailyEntry> {
  const out: Partial<DailyEntry> = {};

  // Numeric scales — only set when the daily row hasn't recorded one.
  fillNumber(out, existing, parsed, "energy");
  fillNumber(out, existing, parsed, "sleep_quality");
  fillNumber(out, existing, parsed, "appetite");
  fillNumber(out, existing, parsed, "pain_current");
  fillNumber(out, existing, parsed, "pain_worst");
  fillNumber(out, existing, parsed, "mood_clarity");
  fillNumber(out, existing, parsed, "nausea");
  fillNumber(out, existing, parsed, "fatigue");
  fillNumber(out, existing, parsed, "anorexia");
  fillNumber(out, existing, parsed, "abdominal_pain");
  fillNumber(out, existing, parsed, "neuropathy_hands");
  fillNumber(out, existing, parsed, "neuropathy_feet");
  fillNumber(out, existing, parsed, "weight_kg");
  fillNumber(out, existing, parsed, "diarrhoea_count");

  // Booleans — only flip undefined → true. Never invert true → false
  // and never write false from a memo (silence isn't denial).
  flipTrue(out, existing, parsed, "cold_dysaesthesia");
  flipTrue(out, existing, parsed, "mouth_sores");
  flipTrue(out, existing, parsed, "fever");

  return out;
}

function fillNumber<K extends NumericFillKey>(
  out: Partial<DailyEntry>,
  existing: Partial<DailyEntry>,
  parsed: VoiceMemoParsedFields,
  key: K,
): void {
  const incoming = parsed[key];
  if (typeof incoming !== "number") return;
  if (typeof existing[key] === "number") return;
  out[key] = incoming;
}

function flipTrue<K extends BoolFillKey>(
  out: Partial<DailyEntry>,
  existing: Partial<DailyEntry>,
  parsed: VoiceMemoParsedFields,
  key: K,
): void {
  if (parsed[key] !== true) return;
  if (existing[key] === true) return;
  out[key] = true;
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
