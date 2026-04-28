import { describe, it, expect } from "vitest";
import {
  parseSseStream,
  readTranscriptionFrame,
} from "~/lib/voice-memo/sse";

function streamFrom(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: { event?: string; data: string }[] = [];
  for await (const frame of parseSseStream(stream)) out.push(frame);
  return out;
}

describe("parseSseStream", () => {
  it("reassembles events split across chunk boundaries", async () => {
    const frames = await collect(
      streamFrom(
        "event: transcript.text.delta\n",
        'data: {"type":"transcript.text.delta","delta":"Hello"}\n\n',
        "event: transcript.text.delta\n",
        'data: {"type":"transcript.text.delta","delta":" world"}\n\n',
      ),
    );
    expect(frames).toHaveLength(2);
    expect(frames[0]?.event).toBe("transcript.text.delta");
    expect(frames[1]?.event).toBe("transcript.text.delta");
    expect(JSON.parse(frames[0]!.data).delta).toBe("Hello");
    expect(JSON.parse(frames[1]!.data).delta).toBe(" world");
  });

  it("tolerates CRLF terminators", async () => {
    const frames = await collect(
      streamFrom(
        'event: x\r\ndata: {"a":1}\r\n\r\n',
        'event: y\r\ndata: {"a":2}\r\n\r\n',
      ),
    );
    expect(frames.map((f) => f.event)).toEqual(["x", "y"]);
  });

  it("ignores comment lines and heartbeats", async () => {
    const frames = await collect(
      streamFrom(
        ': heartbeat\n\n',
        'data: {"type":"transcript.text.done","text":"final"}\n\n',
      ),
    );
    expect(frames).toHaveLength(1);
    expect(JSON.parse(frames[0]!.data).text).toBe("final");
  });
});

describe("readTranscriptionFrame", () => {
  it("translates delta events into typed deltas (append-only, no doubling)", () => {
    const evt = readTranscriptionFrame({
      data: JSON.stringify({
        type: "transcript.text.delta",
        delta: " hello",
      }),
    });
    expect(evt).toEqual({ type: "delta", text: " hello" });
  });

  it("translates done events into typed canonical text", () => {
    const evt = readTranscriptionFrame({
      data: JSON.stringify({
        type: "transcript.text.done",
        text: "Hello world.",
      }),
    });
    expect(evt).toEqual({ type: "done", text: "Hello world." });
  });

  it("drops unknown payloads silently", () => {
    expect(readTranscriptionFrame({ data: "[DONE]" })).toBeNull();
    expect(readTranscriptionFrame({ data: "not json" })).toBeNull();
    expect(
      readTranscriptionFrame({ data: '{"type":"something.else"}' }),
    ).toBeNull();
  });

  it("naive concatenation of deltas matches the canonical done text", () => {
    // This is the property that makes the streaming UX safe — each
    // delta is the new chunk only, never a re-emission of overlapping
    // ranges (the bug that bit the Web Speech API path in PR #135).
    const events = [
      JSON.stringify({ type: "transcript.text.delta", delta: "Today " }),
      JSON.stringify({ type: "transcript.text.delta", delta: "felt " }),
      JSON.stringify({
        type: "transcript.text.delta",
        delta: "alright.",
      }),
      JSON.stringify({
        type: "transcript.text.done",
        text: "Today felt alright.",
      }),
    ];
    let running = "";
    let canonical = "";
    for (const data of events) {
      const evt = readTranscriptionFrame({ data });
      if (!evt) continue;
      if (evt.type === "delta") running += evt.text;
      if (evt.type === "done") canonical = evt.text;
    }
    expect(running).toBe(canonical);
  });
});
