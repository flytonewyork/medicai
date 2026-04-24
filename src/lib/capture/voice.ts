"use client";

import type { CapturedVoice } from "~/types/capture";
import type { CaptureTier } from "./tiers";
import { capsFor } from "./tiers";

// Voice recording via MediaRecorder. Mirrors the VideoRecorder surface
// for consistency, minus the thumbnail / dimension concerns.
//
// Raw audio blobs are preserved without transcription in this slice —
// transcription is deferred (LEGACY_MODULE.md §"Open questions"). The
// per-product decision confirmed by the user is: store raw first,
// transcribe later. Timbre and prosody are irrecoverable from text.

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

export interface VoiceRecorderOptions {
  tier: CaptureTier;
  /** Optional hard override of tier's voiceMaxMs. */
  maxDurationMs?: number;
  onTimeout?: () => void;
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopPromise: Promise<CapturedVoice> | null = null;
  private mimeType = "audio/webm";

  constructor(private readonly opts: VoiceRecorderOptions) {}

  async start(): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("Media capture not available in this environment");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.startedAt = Date.now();
    this.recorder.start();

    const caps = capsFor(this.opts.tier);
    const maxMs = this.opts.maxDurationMs ?? caps.voiceMaxMs;
    this.stopTimer = setTimeout(() => {
      this.opts.onTimeout?.();
      void this.stop();
    }, maxMs);

    return this.stream;
  }

  async stop(): Promise<CapturedVoice> {
    if (this.stopPromise) return this.stopPromise;
    if (!this.recorder) {
      throw new Error("VoiceRecorder.stop called before start");
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.stopPromise = new Promise<CapturedVoice>((resolve, reject) => {
      const rec = this.recorder!;
      rec.onstop = () => {
        const duration_ms = Date.now() - this.startedAt;
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.releaseStream();
        resolve({
          kind: "voice",
          blob,
          mime_type: this.mimeType,
          duration_ms,
        });
      };
      try {
        rec.stop();
      } catch (err) {
        reject(err);
      }
    });
    return this.stopPromise;
  }

  cancel(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.releaseStream();
    this.recorder = null;
    this.chunks = [];
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
