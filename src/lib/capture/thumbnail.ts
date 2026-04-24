"use client";

// Thumbnail generation for photos and videos. Used so the timeline list
// can render small JPEG posters without rehydrating the full blob from
// IndexedDB. Kept deliberately simple — no progressive loading, no
// multi-size variants; one poster per media row is enough for v1.

const THUMB_MAX_EDGE = 480;
const THUMB_QUALITY = 0.78;

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality = THUMB_QUALITY,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

function scaledDims(
  srcW: number,
  srcH: number,
  maxEdge = THUMB_MAX_EDGE,
): { w: number; h: number } {
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  return {
    w: Math.max(1, Math.round(srcW * scale)),
    h: Math.max(1, Math.round(srcH * scale)),
  };
}

/** Generate a JPEG thumbnail from a photo Blob. */
export async function photoThumbnail(photo: Blob): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("photoThumbnail is browser-only");
  }
  const url = URL.createObjectURL(photo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const { w, h } = scaledDims(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return await canvasToJpegBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Grab a poster frame from a video Blob at the given offset (ms).
 * Some browsers refuse to draw a frame before first-metadata; we seek
 * to min(offset, duration - 100ms) as a safety margin.
 */
export async function videoPosterFrame(
  video: Blob,
  offsetMs = 250,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("videoPosterFrame is browser-only");
  }
  const url = URL.createObjectURL(video);
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error("Video metadata load failed"));
    });
    const durationMs = Number.isFinite(el.duration)
      ? el.duration * 1000
      : offsetMs;
    const seekMs = Math.min(offsetMs, Math.max(0, durationMs - 100));
    await new Promise<void>((resolve, reject) => {
      el.onseeked = () => resolve();
      el.onerror = () => reject(new Error("Video seek failed"));
      el.currentTime = seekMs / 1000;
    });
    const { w, h } = scaledDims(el.videoWidth || 1, el.videoHeight || 1);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.drawImage(el, 0, 0, w, h);
    return await canvasToJpegBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
