"use client";

import type { CapturedVideo } from "~/types/capture";
import type { CaptureTier } from "./tiers";
import { capsFor } from "./tiers";
import { videoPosterFrame } from "./thumbnail";

// Video recording via MediaRecorder. The `VideoRecorder` class is the
// lower-level handle — call `start()` to begin, `stop()` to finish, or
// let the internal timer enforce the tier cap.
//
// Kept as a class (not a hook) so it can be driven from both React and
// non-React contexts (e.g. a session-based capture flow that sequences
// multiple clips without remounting).

const VIDEO_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const type of VIDEO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "video/webm";
}

export interface VideoRecorderOptions {
  tier: CaptureTier;
  /** Facing mode for camera. Defaults to "user" (selfie) on mobile. */
  facing?: "user" | "environment";
  /** Optional hard override of tier's videoMaxMs. */
  maxDurationMs?: number;
  onTimeout?: () => void;
}

export class VideoRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopPromise: Promise<CapturedVideo> | null = null;
  private mimeType = "video/webm";

  constructor(private readonly opts: VideoRecorderOptions) {}

  async start(): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      throw new Error("Media capture not available in this environment");
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.opts.facing ?? "user" },
      audio: true,
    });
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
    const maxMs = this.opts.maxDurationMs ?? caps.videoMaxMs;
    this.stopTimer = setTimeout(() => {
      this.opts.onTimeout?.();
      void this.stop();
    }, maxMs);

    return this.stream;
  }

  /** Stop recording + return the finalized CapturedVideo with poster. */
  async stop(): Promise<CapturedVideo> {
    if (this.stopPromise) return this.stopPromise;
    if (!this.recorder) {
      throw new Error("VideoRecorder.stop called before start");
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.stopPromise = new Promise<CapturedVideo>((resolve, reject) => {
      const rec = this.recorder!;
      rec.onstop = async () => {
        try {
          const duration_ms = Date.now() - this.startedAt;
          const blob = new Blob(this.chunks, { type: this.mimeType });
          // Read back natural dimensions from the recorded file.
          const { width, height } = await probeVideoDims(blob);
          let thumbnail_blob: Blob | undefined;
          try {
            thumbnail_blob = await videoPosterFrame(blob, 250);
          } catch {
            // Thumbnail is best-effort; capture still succeeds without.
            thumbnail_blob = undefined;
          }
          this.releaseStream();
          resolve({
            kind: "video",
            blob,
            mime_type: this.mimeType,
            duration_ms,
            width,
            height,
            thumbnail_blob,
          });
        } catch (err) {
          this.releaseStream();
          reject(err);
        }
      };
      try {
        rec.stop();
      } catch (err) {
        reject(err);
      }
    });
    return this.stopPromise;
  }

  /** Abort in-flight recording without producing output. */
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

async function probeVideoDims(
  blob: Blob,
): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(blob);
  const el = document.createElement("video");
  el.muted = true;
  el.preload = "metadata";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error("metadata load failed"));
    });
    return { width: el.videoWidth || undefined, height: el.videoHeight || undefined };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
