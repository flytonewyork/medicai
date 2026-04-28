"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "~/lib/db/dexie";
import { persistVoiceMemo } from "~/lib/voice-memo/persist";
import { uploadVoiceMemoAudio } from "~/lib/voice-memo/cloud";
import { parseVoiceMemo } from "~/lib/voice-memo/parse";
import {
  parseSseStream,
  readTranscriptionFrame,
} from "~/lib/voice-memo/sse";
import type { VoiceMemo } from "~/types/voice-memo";
import type { EnteredBy } from "~/types/clinical";

// Click-to-record voice transcription via Whisper. The patient taps
// once to start, taps again to stop. We record the whole utterance
// with MediaRecorder, send the blob to /api/ai/transcribe, then —
// unless the caller opts out — persist the audio + transcript as a
// `voice_memos` row so the diary timeline can replay it later. The
// finalised transcript is also handed back through `onTranscribed`
// for callers that want to feed it into another flow (e.g. /log).
//
// Returns `null` if the browser has no MediaRecorder support so
// callers can hide the mic surface cleanly. Errors surface via
// `error`; the hook never throws into render.

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const type of AUDIO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

export type VoiceTranscriptionStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "error";

export interface UseVoiceTranscriptionResult {
  status: VoiceTranscriptionStatus;
  error: string | null;
  /**
   * Running transcript text as Whisper streams it back. Empty until
   * the first SSE delta lands, then grows append-only — no doubling.
   * Cleared when the patient starts a new recording.
   */
  liveText: string;
  start: () => Promise<void>;
  stop: () => void;
  cancel: () => void;
}

export interface UseVoiceTranscriptionOptions {
  locale?: "en" | "zh";
  /** Hard cap on a single recording (ms). Default 5 minutes. */
  maxDurationMs?: number;
  /** Called once with the final transcript text after Whisper returns. */
  onTranscribed: (text: string) => void;
  /**
   * Persist the audio + transcript as a `voice_memos` row so the diary
   * timeline can replay it. Defaults to true — voice memos are the
   * patient's primary self-report channel and should never be thrown
   * away. Pass false only when the recording is genuinely transient
   * (e.g. testing).
   */
  persist?: boolean;
  /**
   * Where the recording was captured. Stored on the memo row so the
   * diary can attribute the entry. Defaults to "diary".
   */
  source?: VoiceMemo["source_screen"];
  /** Who recorded the memo. Defaults to "patient". */
  enteredBy?: EnteredBy;
  /**
   * Called after the memo row is committed to Dexie (and before the
   * cloud upload finishes). Lets callers link the memo to other rows
   * — e.g. /log persists a `log_events` row alongside, then patches
   * `log_event_id` onto the memo.
   */
  onPersisted?: (memo: { memo_id: number; transcript: string }) => void;
  /**
   * Run the Slice-2 Claude parser after persistence so the memo's
   * structured fields land on the row and are safe-filled into
   * `daily_entries`. Defaults to true for diary, log, and any other
   * source — voice memos as foundational data means structured
   * extraction is on by default. Pass false for one-off transient
   * captures (test fixtures, fully-typed flows that bypass diary).
   */
  parseAfterPersist?: boolean;
}

export function useVoiceTranscription(
  opts: UseVoiceTranscriptionOptions,
): UseVoiceTranscriptionResult | null {
  const {
    locale = "en",
    maxDurationMs = 5 * 60 * 1000,
    onTranscribed,
    persist = true,
    source = "diary",
    enteredBy = "hulin",
    onPersisted,
    parseAfterPersist = true,
  } = opts;

  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<VoiceTranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Keep the latest callback in a ref so we don't rebuild start/stop
  // every render and lose the recorder mid-session.
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;
  const onPersistedRef = useRef(onPersisted);
  onPersistedRef.current = onPersisted;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const enteredByRef = useRef(enteredBy);
  enteredByRef.current = enteredBy;
  const parseAfterPersistRef = useRef(parseAfterPersist);
  parseAfterPersistRef.current = parseAfterPersist;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.MediaRecorder === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    setSupported(true);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
  }, [releaseStream]);

  // Always tear the stream down on unmount so the mic indicator goes
  // away if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore — already stopped
      }
      cleanup();
    };
  }, [cleanup]);

  async function uploadAndTranscribe(
    blob: Blob,
    mime: string,
    onDelta: (running: string) => void,
  ): Promise<string> {
    const form = new FormData();
    form.append("audio", blob, `voice-memo.${extFor(mime)}`);
    form.append("locale", localeRef.current);
    const res = await fetch("/api/ai/transcribe", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `transcribe failed (${res.status})`);
    }
    const isStream =
      res.headers.get("x-anchor-stream") === "1" ||
      (res.headers.get("content-type") ?? "").includes("text/event-stream");
    if (!isStream || !res.body) {
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      if (text) onDelta(text);
      return text;
    }

    let running = "";
    let canonical = "";
    for await (const frame of parseSseStream(res.body)) {
      const evt = readTranscriptionFrame(frame);
      if (!evt) continue;
      if (evt.type === "delta") {
        running += evt.text;
        onDelta(running);
      } else if (evt.type === "done") {
        canonical = evt.text;
      }
    }
    const finalText = (canonical || running).trim();
    if (finalText) onDelta(finalText);
    return finalText;
  }

  const start = useCallback(async () => {
    if (!supported) return;
    if (status === "recording" || status === "transcribing") return;
    setError(null);
    setLiveText("");
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const localChunks = chunks.slice();
        const localMime = mime;
        const durationMs = startedAtRef.current
          ? Date.now() - startedAtRef.current
          : 0;
        cleanup();
        if (cancelledRef.current) {
          setStatus("idle");
          return;
        }
        if (localChunks.length === 0) {
          setStatus("idle");
          return;
        }
        const blob = new Blob(localChunks, { type: localMime });
        setStatus("transcribing");
        // Persist the audio + memo row BEFORE transcription so a
        // failed Whisper call doesn't throw the recording away. The
        // memo lands in /memos either way; if transcription fails
        // the patient sees an empty-transcript memo with a
        // "Re-transcribe" affordance on the detail page.
        void (async () => {
          let memoId: number | null = null;
          if (persistRef.current) {
            try {
              const { memo_id } = await persistVoiceMemo({
                blob,
                mime: localMime,
                duration_ms: durationMs,
                transcript: "",
                locale: localeRef.current,
                entered_by: enteredByRef.current,
                source_screen: sourceRef.current,
              });
              memoId = memo_id;
              void uploadVoiceMemoAudio(memo_id).catch((err) => {
                // eslint-disable-next-line no-console
                console.warn("[voice-memo] cloud upload failed", err);
              });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn("[voice-memo] persist failed", err);
            }
          }

          let text = "";
          let transcribeError: string | null = null;
          try {
            text = await uploadAndTranscribe(blob, localMime, (running) => {
              setLiveText(running);
              if (memoId !== null) {
                // Persist the running text on the memo too so the
                // diary card and /memos list reflect progress in real
                // time. update() is cheap (one row, no index change)
                // and the live UX of words appearing is worth it.
                void db.voice_memos
                  .update(memoId, {
                    transcript: running,
                    updated_at: new Date().toISOString(),
                  })
                  .catch(() => {
                    // already handled — best effort
                  });
              }
            });
          } catch (err) {
            transcribeError = err instanceof Error ? err.message : String(err);
          }

          if (memoId !== null && text) {
            try {
              await db.voice_memos.update(memoId, {
                transcript: text,
                updated_at: new Date().toISOString(),
              });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn("[voice-memo] transcript update failed", err);
            }
          }

          if (memoId !== null && text && parseAfterPersistRef.current) {
            void parseVoiceMemo(memoId).catch((err) => {
              // eslint-disable-next-line no-console
              console.warn("[voice-memo] parse failed", err);
            });
          }

          if (memoId !== null) {
            onPersistedRef.current?.({ memo_id: memoId, transcript: text });
          }
          if (text) onTranscribedRef.current(text);

          if (transcribeError) {
            setError(transcribeError);
            setStatus("error");
          } else {
            setStatus("idle");
          }
        })();
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = chunks;
      mimeRef.current = mime;
      startedAtRef.current = Date.now();
      recorder.start();
      setStatus("recording");

      stopTimerRef.current = setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          // already stopped
        }
      }, maxDurationMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStatus("error");
      cleanup();
    }
  }, [cleanup, maxDurationMs, status, supported]);

  const stop = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "inactive") return;
    try {
      rec.stop();
    } catch {
      // already stopped
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const rec = recorderRef.current;
    try {
      rec?.stop();
    } catch {
      // ignore
    }
    cleanup();
    setStatus("idle");
    setError(null);
    setLiveText("");
  }, [cleanup]);

  if (!supported) return null;
  return { status, error, liveText, start, stop, cancel };
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
