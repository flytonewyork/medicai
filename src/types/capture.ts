// Shared capture result types. Any capture primitive in
// src/lib/capture/* must produce one of these shapes so DB helpers
// and UI callers have a single target interface.

export interface CapturedPhoto {
  kind: "photo";
  blob: Blob;
  mime_type: string;
  width: number;
  height: number;
  /** EXIF DateTimeOriginal when available, else undefined. */
  taken_at?: string;
}

export interface CapturedVideo {
  kind: "video";
  blob: Blob;
  mime_type: string;
  duration_ms: number;
  width?: number;
  height?: number;
  /** Poster frame JPEG for timeline list rendering. */
  thumbnail_blob?: Blob;
}

export interface CapturedVoice {
  kind: "voice";
  blob: Blob;
  mime_type: string;
  duration_ms: number;
}

export type CapturedMedia = CapturedPhoto | CapturedVideo | CapturedVoice;
