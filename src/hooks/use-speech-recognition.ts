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
  transcript: string;
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
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
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
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setTranscript((cur) => {
        const next = (cur + finalText).trim();
        if (interimText) return `${next} ${interimText.trim()}`.trim();
        return next;
      });
      if (finalText.trim() && onFinalRef.current) {
        onFinalRef.current(finalText.trim());
      }
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

  const reset = useCallback(() => setTranscript(""), []);

  if (!supported) return null;
  return { listening, transcript, error, start, stop, toggle, reset };
}
