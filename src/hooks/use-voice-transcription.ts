"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Click-to-record voice transcription via Whisper. The patient taps
// once to start, taps again to stop. We record the whole utterance
// with MediaRecorder, then upload the blob to /api/ai/transcribe and
// hand the finalised text back through `onTranscribed` once. No
// streaming, no interim results — the transcript appears in one go,
// so the textarea never shows mid-utterance text that could repeat.
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
}

export function useVoiceTranscription(
  opts: UseVoiceTranscriptionOptions,
): UseVoiceTranscriptionResult | null {
  const { locale = "en", maxDurationMs = 5 * 60 * 1000, onTranscribed } = opts;

  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<VoiceTranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("audio/webm");
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Keep the latest callback in a ref so we don't rebuild start/stop
  // every render and lose the recorder mid-session.
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;
  const localeRef = useRef(locale);
  localeRef.current = locale;

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

  async function uploadAndTranscribe(blob: Blob, mime: string) {
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
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim();
  }

  const start = useCallback(async () => {
    if (!supported) return;
    if (status === "recording" || status === "transcribing") return;
    setError(null);
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
        uploadAndTranscribe(blob, localMime)
          .then((text) => {
            if (text) onTranscribedRef.current(text);
            setStatus("idle");
          })
          .catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus("error");
          });
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = chunks;
      mimeRef.current = mime;
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
  }, [cleanup]);

  if (!supported) return null;
  return { status, error, start, stop, cancel };
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
