"use client";

export interface PreparedImage {
  base64: string;
  mediaType: "image/jpeg";
  width: number;
  height: number;
  approxKB: number;
}

/**
 * Load a File as an HTMLImageElement (browser-only).
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Resize + re-encode an image to keep Claude Vision payloads small.
 * Caps the long edge at `maxEdge` (default 1600 px) and JPEG quality.
 */
export async function prepareImageForVision(
  file: File,
  { maxEdge = 1600, quality = 0.82 }: { maxEdge?: number; quality?: number } = {},
): Promise<PreparedImage> {
  if (typeof window === "undefined") {
    throw new Error("prepareImageForVision is browser-only");
  }
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to get 2D canvas context");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas blob failed"))),
      "image/jpeg",
      quality,
    );
  });
  const buf = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return {
    base64,
    mediaType: "image/jpeg",
    width: w,
    height: h,
    approxKB: Math.round(blob.size / 1024),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
