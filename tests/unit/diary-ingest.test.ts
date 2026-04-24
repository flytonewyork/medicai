import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { ingestDiaryPage } from "~/lib/diary/ingest";
import type { CapturedPhoto } from "~/types/capture";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function photo(): CapturedPhoto {
  return {
    kind: "photo",
    blob: new Blob([new Uint8Array(32)], { type: "image/jpeg" }),
    mime_type: "image/jpeg",
    width: 2048,
    height: 2732,
    taken_at: "2026-04-24T09:15:00",
  };
}

describe("ingestDiaryPage", () => {
  it("creates a diary life_event + attached media without OCR", async () => {
    const result = await ingestDiaryPage({
      photo: photo(),
      author: "hulin",
      entry_date: "2026-04-24",
      title: "Morning thoughts",
    });
    expect(typeof result.life_event_id).toBe("number");
    expect(typeof result.media_id).toBe("number");
    expect(result.ocr_text).toBeUndefined();

    const event = await db.life_events.get(result.life_event_id);
    expect(event?.category).toBe("diary");
    expect(event?.is_memory).toBe(true);
    expect(event?.author).toBe("hulin");
    expect(event?.title).toBe("Morning thoughts");
    expect(event?.event_date).toBe("2026-04-24");
    expect(event?.notes).toBeUndefined();

    const media = await db.timeline_media
      .where("[owner_type+owner_id]")
      .equals(["life_event", result.life_event_id])
      .toArray();
    expect(media).toHaveLength(1);
    expect(media[0]?.kind).toBe("photo");
  });

  it("writes OCR text into notes when runOcr returns content", async () => {
    const result = await ingestDiaryPage({
      photo: photo(),
      author: "hulin",
      entry_date: "2026-04-24",
      runOcr: async () => ({
        text: "  Today I walked in the garden and remembered my father.  ",
        confidence: 0.87,
      }),
    });
    const event = await db.life_events.get(result.life_event_id);
    expect(event?.notes).toBe(
      "Today I walked in the garden and remembered my father.",
    );
    expect(result.ocr_text).toBe(
      "Today I walked in the garden and remembered my father.",
    );
    expect(result.ocr_confidence).toBeCloseTo(0.87);
  });

  it("swallows OCR failure but still preserves photo + entry", async () => {
    const result = await ingestDiaryPage({
      photo: photo(),
      author: "hulin",
      runOcr: async () => {
        throw new Error("tesseract failed");
      },
    });
    expect(typeof result.life_event_id).toBe("number");
    expect(typeof result.media_id).toBe("number");
    expect(result.ocr_text).toBeUndefined();

    const event = await db.life_events.get(result.life_event_id);
    expect(event?.category).toBe("diary");
    expect(event?.notes).toBeUndefined();
  });

  it("defaults title and entry_date when absent", async () => {
    const result = await ingestDiaryPage({
      photo: photo(),
      author: "hulin",
    });
    const event = await db.life_events.get(result.life_event_id);
    expect(event?.title).toMatch(/^Diary — \d{4}-\d{2}-\d{2}$/);
    expect(event?.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not overwrite notes when OCR returns empty string", async () => {
    const result = await ingestDiaryPage({
      photo: photo(),
      author: "hulin",
      runOcr: async () => ({ text: "   ", confidence: 0.1 }),
    });
    const event = await db.life_events.get(result.life_event_id);
    expect(event?.notes).toBeUndefined();
  });
});
