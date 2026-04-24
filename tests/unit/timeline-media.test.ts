import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  attachMedia,
  deleteMedia,
  deleteMediaForOwner,
  listMediaByKind,
  listMediaForOwner,
} from "~/lib/db/timeline-media";
import type {
  CapturedPhoto,
  CapturedVideo,
  CapturedVoice,
} from "~/types/capture";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function makeBlob(bytes = 16, type = "application/octet-stream"): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

function photoOf(takenAt?: string): CapturedPhoto {
  return {
    kind: "photo",
    blob: makeBlob(32, "image/jpeg"),
    mime_type: "image/jpeg",
    width: 1024,
    height: 768,
    taken_at: takenAt,
  };
}

function videoOf(durationMs: number): CapturedVideo {
  return {
    kind: "video",
    blob: makeBlob(64, "video/webm"),
    mime_type: "video/webm",
    duration_ms: durationMs,
    width: 640,
    height: 480,
    thumbnail_blob: makeBlob(8, "image/jpeg"),
  };
}

function voiceOf(durationMs: number): CapturedVoice {
  return {
    kind: "voice",
    blob: makeBlob(32, "audio/webm"),
    mime_type: "audio/webm",
    duration_ms: durationMs,
  };
}

// fake-indexeddb's structuredClone doesn't preserve Blob identity in a
// jsdom environment — Blobs round-trip as empty objects. Real browsers
// are fine. These tests therefore assert that the blob slot is present
// and metadata survives; actual Blob content is exercised only in e2e
// (real browser) where it matters.

describe("timeline_media DB helpers", () => {
  it("attaches a photo and round-trips via listMediaForOwner", async () => {
    const id = await attachMedia({
      owner_type: "life_event",
      owner_id: 1,
      captured: photoOf("2025-01-15T14:30:00"),
      created_by: "thomas",
      caption: "Dad at the beach",
    });
    expect(typeof id).toBe("number");

    const rows = await listMediaForOwner("life_event", 1);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.kind).toBe("photo");
    expect(r.width).toBe(1024);
    expect(r.height).toBe(768);
    expect(r.taken_at).toBe("2025-01-15T14:30:00");
    expect(r.caption).toBe("Dad at the beach");
    expect(r.created_by).toBe("thomas");
    expect(r.blob).toBeDefined();
  });

  it("stores video dimensions, duration, and thumbnail slot", async () => {
    await attachMedia({
      owner_type: "appointment",
      owner_id: 42,
      captured: videoOf(4200),
      created_by: "catherine",
    });
    const [row] = await listMediaForOwner("appointment", 42);
    expect(row?.kind).toBe("video");
    expect(row?.duration_ms).toBe(4200);
    expect(row).toHaveProperty("thumbnail_blob");
    expect(row?.width).toBe(640);
  });

  it("stores voice with duration and no thumbnail slot", async () => {
    await attachMedia({
      owner_type: "family_note",
      owner_id: 7,
      captured: voiceOf(15_000),
      created_by: "hulin",
    });
    const [row] = await listMediaForOwner("family_note", 7);
    expect(row?.kind).toBe("voice");
    expect(row?.duration_ms).toBe(15_000);
    expect(row).not.toHaveProperty("thumbnail_blob");
  });

  it("orders media by taken_at (fallback created_at)", async () => {
    await attachMedia({
      owner_type: "life_event",
      owner_id: 5,
      captured: photoOf("2025-03-10T12:00:00"),
      created_by: "thomas",
    });
    await attachMedia({
      owner_type: "life_event",
      owner_id: 5,
      captured: photoOf("2025-01-01T09:00:00"),
      created_by: "thomas",
    });
    const rows = await listMediaForOwner("life_event", 5);
    expect(rows.map((r) => r.taken_at)).toEqual([
      "2025-01-01T09:00:00",
      "2025-03-10T12:00:00",
    ]);
  });

  it("filters by media kind", async () => {
    await attachMedia({
      owner_type: "life_event",
      owner_id: 1,
      captured: photoOf("2025-06-01T10:00:00"),
      created_by: "thomas",
    });
    await attachMedia({
      owner_type: "life_event",
      owner_id: 1,
      captured: voiceOf(8000),
      created_by: "thomas",
    });
    const photos = await listMediaByKind("photo");
    const voices = await listMediaByKind("voice");
    expect(photos).toHaveLength(1);
    expect(voices).toHaveLength(1);
  });

  it("deletes a single media row", async () => {
    const id = await attachMedia({
      owner_type: "life_event",
      owner_id: 9,
      captured: photoOf(),
      created_by: "thomas",
    });
    await deleteMedia(id);
    const rows = await listMediaForOwner("life_event", 9);
    expect(rows).toHaveLength(0);
  });

  it("deletes all media for one anchor without touching siblings", async () => {
    await attachMedia({
      owner_type: "life_event",
      owner_id: 1,
      captured: photoOf(),
      created_by: "thomas",
    });
    await attachMedia({
      owner_type: "life_event",
      owner_id: 1,
      captured: videoOf(3000),
      created_by: "thomas",
    });
    await attachMedia({
      owner_type: "life_event",
      owner_id: 2,
      captured: photoOf(),
      created_by: "thomas",
    });

    const removed = await deleteMediaForOwner("life_event", 1);
    expect(removed).toBe(2);
    expect(await listMediaForOwner("life_event", 1)).toHaveLength(0);
    expect(await listMediaForOwner("life_event", 2)).toHaveLength(1);
  });
});
