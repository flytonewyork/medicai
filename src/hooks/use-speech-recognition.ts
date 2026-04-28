"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Thin wrapper around the browser's SpeechRecognition Web API. Returns
// `null` when the browser doesn't support it (older Firefox, some
// in-app webviews) so callers can hide the mic button cleanly.
//
// Usage:
//   const sr = useSpeechRecognition({ lang: "en-US" });
//   if (!sr) return null;            // unsupported
//   <button onClick={sr.toggle}>{sr.listening ? "Stop" : "Speak"}</button>
//   <p>{sr.transcript}</p>

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
    length: number;
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionResult {
  listening: boolean;
  /** Full display string: finalised text plus the in-flight interim tail. */
  transcript: string;
  /** In-flight interim words only (empty when nothing pending). */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
}

export function useSpeechRecognition(
  opts: { lang?: string; onFinal?: (text: string) => void } = {},
): UseSpeechRecognitionResult | null {
  const { lang = "en-US", onFinal } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Canonical finalised transcript for the current session. We rebuild
  // this from `e.results` on every event rather than appending deltas:
  // browsers (notably Chrome on Android and Safari) re-emit the same
  // final indices across events, and an interim that becomes final
  // shares its index with the prior interim — so any append-style
  // accumulator double-counts and the patient sees their words repeat.
  const finalRef = useRef("");
  // Capture the latest `onFinal` so we don't have to recreate the
  // recogniser when the parent re-renders with a new closure.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      // Walk the entire results list each time and recompute. This is
      // O(n) per event but n stays small for any realistic utterance,
      // and it's the only way to get a duplication-free transcript.
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      const trimmedFinal = finalText.trim();
      const prevFinal = finalRef.current;
      // Detect the genuinely-new final delta by length comparison
      // against the last canonical final text. We only call onFinal
      // for that delta so callers appending to their own state never
      // see a repeat.
      if (trimmedFinal.length > prevFinal.length) {
        const delta = trimmedFinal.slice(prevFinal.length).trim();
        finalRef.current = trimmedFinal;
        if (delta && onFinalRef.current) onFinalRef.current(delta);
      } else if (trimmedFinal.length < prevFinal.length) {
        // New session started under us (e.g. browser auto-restart);
        // accept the shorter canonical text as the new baseline.
        finalRef.current = trimmedFinal;
      }
      const trimmedInterim = interimText.trim();
      setInterim(trimmedInterim);
      setTranscript(
        trimmedInterim
          ? `${finalRef.current} ${trimmedInterim}`.trim()
          : finalRef.current,
      );
    };
    rec.onerror = (e) => {
      setError(e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => {
      rec.abort();
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setError(null);
    setTranscript("");
    setInterim("");
    finalRef.current = "";
    try {
      recRef.current.start();
      setListening(true);
    } catch {
      // Already started — ignore.
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    finalRef.current = "";
  }, []);

  if (!supported) return null;
  return { listening, transcript, interim, error, start, stop, toggle, reset };
}
