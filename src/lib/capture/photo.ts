"use client";

import type { CapturedPhoto } from "~/types/capture";
import { photoThumbnail } from "./thumbnail";

// Photo capture pipeline. Takes a user-selected File (camera or library),
// reads dimensions + EXIF DateTimeOriginal, and produces a CapturedPhoto.
//
// Existing `CameraCapture` component already handles the `<input>` wiring
// for camera; this module picks up after file selection. Intentionally
// keeps File I/O out of this helper so the same pipeline can be driven
// from drop zones, clipboard paste, or programmatic Blob sources later.

async function readImageDimensions(
  file: Blob,
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Minimal EXIF DateTimeOriginal reader for JPEG. Returns undefined on
 * non-JPEG inputs or when the tag is absent. A full EXIF parser is not
 * needed for v1 — we only care about capture time for chronological
 * ordering on the timeline.
 *
 * Format: "YYYY:MM:DD HH:MM:SS" per EXIF 2.3 §4.6.5. Returned as
 * ISO-8601 with 'T' separator; timezone is left unspecified because
 * EXIF DateTimeOriginal has no TZ field (the TZ-bearing variant,
 * OffsetTimeOriginal, is rare in practice).
 */
async function readExifDateTimeOriginal(
  file: Blob,
): Promise<string | undefined> {
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
    return undefined;
  }
  // Only need the APP1 segment; read the first 128KB which is plenty for
  // real-world images that place EXIF at the front per spec.
  const head = await file.slice(0, 131072).arrayBuffer();
  const view = new DataView(head);
  if (view.byteLength < 4) return undefined;
  // SOI marker
  if (view.getUint16(0) !== 0xffd8) return undefined;

  let offset = 2;
  while (offset < view.byteLength - 4) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint16(offset);
    const segLen = view.getUint16(offset + 2);
    // APP1 EXIF marker
    if (marker === 0xffe1) {
      // Verify "Exif\0\0" header
      if (view.byteLength < offset + 10) return undefined;
      const exifHeader =
        String.fromCharCode(view.getUint8(offset + 4)) +
        String.fromCharCode(view.getUint8(offset + 5)) +
        String.fromCharCode(view.getUint8(offset + 6)) +
        String.fromCharCode(view.getUint8(offset + 7));
      if (exifHeader !== "Exif") return undefined;
      const tiffStart = offset + 10;
      const byteOrder = view.getUint16(tiffStart);
      const little = byteOrder === 0x4949;
      const ifdOffset = view.getUint32(tiffStart + 4, little);
      return findDateTimeTag(view, tiffStart, tiffStart + ifdOffset, little);
    }
    offset += 2 + segLen;
  }
  return undefined;
}

function findDateTimeTag(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  little: boolean,
): string | undefined {
  if (ifdStart + 2 > view.byteLength) return undefined;
  const entryCount = view.getUint16(ifdStart, little);
  for (let i = 0; i < entryCount; i++) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    // 0x8769 ExifIFDPointer — descend into sub-IFD to find 0x9003
    if (tag === 0x8769) {
      const subOffset = view.getUint32(entry + 8, little);
      const found = findDateTimeTag(
        view,
        tiffStart,
        tiffStart + subOffset,
        little,
      );
      if (found) return found;
    }
    // 0x9003 DateTimeOriginal (ASCII, 20 bytes incl null)
    if (tag === 0x9003) {
      const count = view.getUint32(entry + 4, little);
      const valueOffset = view.getUint32(entry + 8, little);
      const absOffset = tiffStart + valueOffset;
      if (absOffset + count > view.byteLength) return undefined;
      let raw = "";
      for (let j = 0; j < count; j++) {
        const c = view.getUint8(absOffset + j);
        if (c === 0) break;
        raw += String.fromCharCode(c);
      }
      // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
      const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/);
      if (!m) return undefined;
      return `${m[1]}-${m[2]}-${m[3]}T${m[4]}`;
    }
  }
  return undefined;
}

/** Wrap a user-supplied File into a CapturedPhoto + thumbnail. */
export async function capturePhoto(file: File): Promise<CapturedPhoto> {
  if (typeof window === "undefined") {
    throw new Error("capturePhoto is browser-only");
  }
  const [{ width, height }, taken_at] = await Promise.all([
    readImageDimensions(file),
    readExifDateTimeOriginal(file),
  ]);
  return {
    kind: "photo",
    blob: file,
    mime_type: file.type || "image/jpeg",
    width,
    height,
    taken_at,
  };
}

/** Wrap + generate thumbnail. Separate so callers can stream UI state. */
export async function capturePhotoWithThumbnail(
  file: File,
): Promise<CapturedPhoto & { thumbnail_blob: Blob }> {
  const photo = await capturePhoto(file);
  const thumbnail_blob = await photoThumbnail(photo.blob);
  return { ...photo, thumbnail_blob };
}
