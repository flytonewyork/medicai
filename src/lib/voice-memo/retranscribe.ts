import { db, now } from "~/lib/db/dexie";
import { parseVoiceMemo } from "./parse";
import { parseSseStream, readTranscriptionFrame } from "./sse";

// Retry transcription for a memo whose first attempt failed
// (env-var glitch, network blip, OpenAI 5xx). Uses the audio Blob
// already in `timeline_media`; the route streams the result back
// via SSE, and as deltas arrive we patch the running text onto the
// memo so the detail-view transcript card fills in word by word.
// On completion, Claude parsing kicks off automatically.

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

  // Clear any stale parse so the detail view's spinner reflects the
  // re-parse that's coming up after the new text lands.
  await db.voice_memos.update(memoId, {
    transcript: "",
    parsed_fields: undefined,
    updated_at: now(),
  });

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

  const isStream =
    res.headers.get("x-anchor-stream") === "1" ||
    (res.headers.get("content-type") ?? "").includes("text/event-stream");

  let text = "";
  if (isStream && res.body) {
    let running = "";
    let canonical = "";
    for await (const frame of parseSseStream(res.body)) {
      const evt = readTranscriptionFrame(frame);
      if (!evt) continue;
      if (evt.type === "delta") {
        running += evt.text;
        await db.voice_memos
          .update(memoId, { transcript: running, updated_at: now() })
          .catch(() => undefined);
      } else if (evt.type === "done") {
        canonical = evt.text;
      }
    }
    text = (canonical || running).trim();
  } else {
    const data = (await res.json()) as { text?: string };
    text = (data.text ?? "").trim();
  }

  if (!text) {
    return { ok: false, error: "Transcription returned no text" };
  }

  await db.voice_memos.update(memoId, {
    transcript: text,
    updated_at: now(),
  });

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
