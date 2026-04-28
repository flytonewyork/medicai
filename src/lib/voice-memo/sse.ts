// SSE parser shared between the live-transcription hook and the
// re-transcribe action. Generic over what each `data:` frame's JSON
// looks like — caller decides which event types matter.
//
// OpenAI's audio/transcriptions stream emits two event types:
//   - `transcript.text.delta` — { type, delta: "next chunk" }
//   - `transcript.text.done`  — { type, text: "full canonical text" }
// Each delta is a brand-new chunk; concatenating deltas gives the
// final text (and the `done` event's `text` field is the canonical
// authority if there's any drift).
//
// Implementation note: the SSE spec terminates events with a blank
// line (\n\n). Servers and proxies sometimes emit \r\n\r\n instead.
// We handle both. We also tolerate `data: [DONE]` sentinels (some
// OpenAI streams use them) by skipping non-JSON data frames.

export interface SseFrame {
  event?: string;
  data: string;
}

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Normalise CRLF so the boundary regex below stays simple.
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const frame = parseSseFrame(raw);
        if (frame) yield frame;
        boundary = buffer.indexOf("\n\n");
      }
    }
    // Flush a trailing event without closing newlines.
    if (buffer.trim()) {
      const frame = parseSseFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseFrame(raw: string): SseFrame | null {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^\s/, ""));
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

export interface TranscriptionDelta {
  type: "delta";
  text: string; // the new chunk only, NOT the cumulative running text
}

export interface TranscriptionDone {
  type: "done";
  text: string; // canonical full transcript
}

export type TranscriptionEvent = TranscriptionDelta | TranscriptionDone;

// Translate a decoded SSE frame into the typed events the UI cares
// about. Unknown payloads are dropped so future OpenAI additions
// don't blow up the parser.
export function readTranscriptionFrame(
  frame: SseFrame,
): TranscriptionEvent | null {
  if (frame.data === "[DONE]") return null;
  let parsed: { type?: string; delta?: string; text?: string };
  try {
    parsed = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (parsed.type === "transcript.text.delta" && typeof parsed.delta === "string") {
    return { type: "delta", text: parsed.delta };
  }
  if (parsed.type === "transcript.text.done" && typeof parsed.text === "string") {
    return { type: "done", text: parsed.text };
  }
  return null;
}
