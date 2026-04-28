import { NextResponse } from "next/server";

// Voice-memo transcription. Browser records via MediaRecorder, posts
// the resulting audio blob here as multipart/form-data; we hand it
// to OpenAI's gpt-4o-mini-transcribe with `stream=true` and proxy the
// resulting SSE stream straight back to the client. Each SSE event is
// append-only — the `transcript.text.delta` events deliver new text
// chunks, not re-emitted overlapping ranges, so the client can
// concatenate without any de-dup logic.
//
// Why gpt-4o-mini-transcribe over whisper-1: whisper-1 doesn't stream,
// so the patient stares at "Transcribing…" until the whole thing
// returns. The mini variant streams (typically 0.5–2s to first word)
// and is half the price ($0.003/min vs $0.006/min). Same accuracy
// envelope as Whisper for short, conversational memos.
//
// Anthropic's API doesn't accept audio at all, so OpenAI is the only
// surface for the actual speech-to-text step.
//
// Auth: this route does NOT require a signed-in Supabase session.
// Voice memos are foundational for dad's diary, and the project is
// local-first (per middleware.ts and CLAUDE.md): the app must work
// before the patient ever signs in. The OpenAI key is bounded by
// the standard per-account rate limits, and the app is single-
// household by design — IP-level rate limiting would be the right
// hardening if this ever sits behind a public URL.

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI's hard limit.

const STREAMING_MODELS = new Set([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
]);

export async function POST(req: Request) {
  const apiKeyResult = readApiKey();
  if (apiKeyResult.error) return apiKeyResult.error;
  const apiKey = apiKeyResult.key;

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

  const model =
    process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
  const wantsStream = STREAMING_MODELS.has(model);

  const mime = audio.type.split(";")[0]?.trim() || "audio/webm";
  const ext = mimeToExt(mime);
  const filename = `voice-memo.${ext}`;

  const upload = new FormData();
  upload.append(
    "file",
    new File([audio], filename, { type: mime }),
    filename,
  );
  upload.append("model", model);
  upload.append("language", locale);
  if (wantsStream) {
    upload.append("stream", "true");
    upload.append("response_format", "json");
  } else {
    upload.append("response_format", "json");
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upload,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: detail || `Whisper returned ${upstream.status}` },
      { status: 502 },
    );
  }

  // Streaming path — proxy the SSE body straight back to the browser.
  // Setting cache-control no-cache here matters because some PWAs /
  // CDNs would otherwise buffer or coalesce the event stream and
  // defeat the live UX.
  if (wantsStream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "x-anchor-stream": "1",
      },
    });
  }

  // Non-streaming fallback (whisper-1 or any model not in the streaming
  // set). Returns a plain JSON envelope the client unwraps without
  // touching the SSE parser.
  const data = (await upstream.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  return NextResponse.json({ text });
}

function readApiKey():
  | { key: string; error?: undefined }
  | { error: NextResponse; key?: undefined } {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) {
    return {
      error: NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 503 },
      ),
    };
  }
  const cleaned = raw.trim();
  if (!cleaned) {
    return {
      error: NextResponse.json(
        { error: "OPENAI_API_KEY is empty after trimming." },
        { status: 503 },
      ),
    };
  }
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      return {
        error: NextResponse.json(
          {
            error:
              "OPENAI_API_KEY contains a non-ASCII character " +
              `(0x${code.toString(16)} at position ${i}). ` +
              "Rotate the key in Vercel env without smart-quote substitution " +
              "(paste it as plain text, not from rich-text sources).",
          },
          { status: 503 },
        ),
      };
    }
  }
  return { key: cleaned };
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
