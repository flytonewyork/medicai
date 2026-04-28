import { db, now } from "~/lib/db/dexie";
import { postJson } from "~/lib/utils/http";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";

// Slice 3: Claude reads every memo end-to-end and returns a structured
// picture of it (daily-tracking fields, clinic visits, future
// appointments, medications mentioned, plus personal content like
// food / family / practice / goals / mood). The result lands on the
// memo as `parsed_fields`. Crucially we no longer fan out to
// `daily_entries` automatically — the patient reviews the parse on
// the memo detail page and clicks "Log to forms" before any clinical
// table is touched.
//
// Why preview-then-apply?
//   1. Whisper + Claude both make mistakes; silent overwrites would
//      poison tracking with no recovery affordance.
//   2. The patient gets to correct miscaptured numbers before they
//      drive zone evaluation downstream.
//   3. Personal content stays visible on the memo without any
//      auto-fan-out at all (no clinical patches to track for it).

interface ParseResponse {
  parsed: VoiceMemoParsedFields;
}

// Run Claude on a memo's transcript and persist the parsed shape onto
// the memo row. Idempotent — does nothing if `parsed_fields` is
// already set. Errors are logged, not thrown into the UI; the memo
// detail view exposes a "Re-parse" affordance for retries.
export async function parseVoiceMemo(memoId: number): Promise<void> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return;
  if (memo.parsed_fields) return;
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
}

// Force-re-run the parser even when parsed_fields is already set.
// Drives the "Re-parse" button on the memo detail page when Claude's
// first pass missed something the patient cared about. Clears any
// previously applied patches' record — but does NOT roll back the
// rows those patches wrote, so re-applying after a re-parse is the
// patient's call.
export async function reparseVoiceMemo(memoId: number): Promise<void> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return;
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
    console.warn("[voice-memo] re-parse failed", memoId, err);
    return;
  }
  await db.voice_memos.update(memoId, {
    parsed_fields: { ...parsed, applied_patches: undefined },
    updated_at: now(),
  });
}
