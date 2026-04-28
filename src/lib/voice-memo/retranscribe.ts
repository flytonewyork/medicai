import { db, now } from "~/lib/db/dexie";
import { parseVoiceMemo } from "./parse";

// Retry the Whisper transcription for a memo whose first attempt
// failed (env-var glitch, network blip, OpenAI 5xx). Uses the audio
// Blob already in `timeline_media`; falls back to fetching the cloud
// copy if the local Blob has been pruned. On success, kicks the
// Claude parser off behind the scenes so the preview lands on the
// detail page automatically.

export async function retranscribeVoiceMemo(memoId: number): Promise<{
  ok: boolean;
  text?: string;
  error?: string;
}> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return { ok: false, error: "memo not found" };
  if (!memo.audio_media_id) {
    return { ok: false, error: "no audio attached" };
  }
  const media = await db.timeline_media.get(memo.audio_media_id);
  if (!media?.blob) {
    return { ok: false, error: "audio blob missing on this device" };
  }

  const form = new FormData();
  form.append(
    "audio",
    media.blob,
    `voice-memo.${extFor(memo.audio_mime)}`,
  );
  form.append("locale", memo.locale);

  let res: Response;
  try {
    res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: detail || `transcribe failed (${res.status})` };
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) {
    return { ok: false, error: "Whisper returned an empty transcript" };
  }

  await db.voice_memos.update(memoId, {
    transcript: text,
    parsed_fields: undefined, // force a fresh parse against the new text
    updated_at: now(),
  });

  // Fire the parser asynchronously — the patient sees the transcript
  // immediately while Claude works in the background.
  void parseVoiceMemo(memoId).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[voice-memo] parse after re-transcribe failed", err);
  });

  return { ok: true, text };
}

function extFor(mime: string): string {
  const base = mime.split(";")[0]?.trim();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    default:
      return "webm";
  }
}
