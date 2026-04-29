import { db, now } from "~/lib/db/dexie";
import { postJson } from "~/lib/utils/http";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";
import { applyMemoPatches } from "./apply";

// Slice 3 → ship: Claude reads every memo end-to-end and returns a
// structured picture of it (daily-tracking fields, clinic visits,
// future appointments, medications mentioned, plus personal content
// like food / family / practice / goals / mood). The result lands on
// the memo as `parsed_fields`.
//
// Auto-apply rule: when the parse comes back with `confidence: high`
// AND there's something patchable (a daily field, a clinic visit, or
// a high-confidence appointment), we run applyMemoPatches() right
// away. The recorder card shows what landed inline with an Undo
// button, so the patient sees the system update at a glance and can
// reverse any single patch without leaving the page. Medium / low
// confidence parses skip the auto-apply and surface a "Review" CTA
// on the memo card; the detail page handles those explicitly.
//
// Why not always require manual confirm? Voice memos are dad's
// primary capture surface — if every recording requires a review tap,
// the friction defeats the foundational-data goal. Confidence high
// means Claude was confident in unambiguous numerics or clear
// descriptions, and Undo is one tap away.

interface ParseResponse {
  parsed: VoiceMemoParsedFields;
}

// Run Claude on a memo's transcript, persist the parsed shape, and —
// when confidence is high and there's content worth applying — run
// the apply step automatically. Errors are logged, never thrown into
// the UI; the memo detail view exposes a "Re-parse" affordance for
// retries.
export async function parseVoiceMemo(memoId: number): Promise<ParseAttempt> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return { ok: false, reason: "memo not found" };
  if (memo.parsed_fields) return { ok: true };
  if (!memo.transcript.trim()) return { ok: false, reason: "no transcript" };

  let parsed: VoiceMemoParsedFields;
  try {
    const res = await postJson<ParseResponse>("/api/ai/parse-voice-memo", {
      transcript: memo.transcript,
      locale: memo.locale,
      recorded_at: memo.recorded_at,
      category: memo.category,
    });
    parsed = res.parsed;
  } catch (err) {
    const reason = humaniseParseError(err);
    // eslint-disable-next-line no-console
    console.warn("[voice-memo] parse failed", memoId, reason);
    return { ok: false, reason };
  }

  await db.voice_memos.update(memoId, {
    parsed_fields: parsed,
    updated_at: now(),
  });

  if (parsed.confidence === "high") {
    try {
      await applyMemoPatches(memoId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[voice-memo] auto-apply failed", memoId, err);
    }
  }
  return { ok: true };
}

export interface ParseAttempt {
  ok: boolean;
  reason?: string;
}

function humaniseParseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // postJson wraps server bodies as `HTTP 502: {"error":"..."}` —
  // unwrap so the patient-facing message is the actual cause.
  const match = raw.match(/HTTP \d+:\s*(.+)/);
  const body = match?.[1] ?? raw;
  if (body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (typeof parsed.error === "string") return parsed.error;
    } catch {
      // fall through
    }
  }
  return body;
}

// Force-re-run the parser even when parsed_fields is already set.
// Drives the "Re-parse" button on the memo detail page when Claude's
// first pass missed something the patient cared about. Clears any
// previously applied patches' record — but does NOT roll back the
// rows those patches wrote, so re-applying after a re-parse is the
// patient's call.
export async function reparseVoiceMemo(memoId: number): Promise<ParseAttempt> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return { ok: false, reason: "memo not found" };
  if (!memo.transcript.trim()) return { ok: false, reason: "no transcript" };
  let parsed: VoiceMemoParsedFields;
  try {
    const res = await postJson<ParseResponse>("/api/ai/parse-voice-memo", {
      transcript: memo.transcript,
      locale: memo.locale,
      recorded_at: memo.recorded_at,
      category: memo.category,
    });
    parsed = res.parsed;
  } catch (err) {
    const reason = humaniseParseError(err);
    // eslint-disable-next-line no-console
    console.warn("[voice-memo] re-parse failed", memoId, reason);
    return { ok: false, reason };
  }
  await db.voice_memos.update(memoId, {
    parsed_fields: { ...parsed, applied_patches: undefined },
    updated_at: now(),
  });
  return { ok: true };
}
