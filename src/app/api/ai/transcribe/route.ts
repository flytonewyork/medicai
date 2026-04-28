import { NextResponse } from "next/server";
import { requireSession } from "~/lib/auth/require-session";

// Voice-memo transcription. The browser records via MediaRecorder and
// posts the resulting audio blob here as multipart/form-data; we hand
// it to OpenAI Whisper and return the finalised text in one go. No
// streaming, no interim results — the patient sees the transcript
// once when it's ready.
//
// Why Whisper not Claude: Anthropic's API doesn't accept audio input.
// Whisper is the industry-standard speech-to-text endpoint, accepts
// the same webm/opus blobs MediaRecorder produces, and supports the
// two locales Anchor cares about (en, zh).

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's hard limit.

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.error;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "audio exceeds 25 MB limit" },
      { status: 413 },
    );
  }

  const localeRaw = form.get("locale");
  const locale = localeRaw === "zh" ? "zh" : "en";

  // Whisper expects a named file with an extension it recognises. The
  // browser sends MIME types like `audio/webm;codecs=opus` — strip the
  // codecs suffix and map to a sensible extension so the upload is
  // accepted on every codec MediaRecorder picks.
  const mime = audio.type.split(";")[0]?.trim() || "audio/webm";
  const ext = mimeToExt(mime);
  const filename = `voice-memo.${ext}`;

  const upload = new FormData();
  upload.append(
    "file",
    new File([audio], filename, { type: mime }),
    filename,
  );
  upload.append("model", "whisper-1");
  upload.append("language", locale);
  upload.append("response_format", "json");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: detail || `Whisper returned ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  return NextResponse.json({ text });
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "webm";
  }
}
