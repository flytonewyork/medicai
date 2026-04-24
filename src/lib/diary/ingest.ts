import { db, now } from "~/lib/db/dexie";
import { attachMedia } from "~/lib/db/timeline-media";
import type { CapturedPhoto } from "~/types/capture";
import type { EnteredBy, LifeEvent } from "~/types/clinical";

// Diary page ingestion. Hu Lin is writing a hand-written diary during
// the bridge period; each page not captured is lost. This orchestrator
// takes a photo of a page and produces:
//   1. a `life_events` row (category: "diary", is_memory: true)
//   2. a `timeline_media` photo attached to that row
//   3. an OCR pass (English + Simplified Chinese) whose text lands in
//      the LifeEvent's `notes` field
//
// OCR is passed in via the `runOcr` parameter so this function stays
// testable — the real caller pipes `ocrImage` from src/lib/ingest/ocr.
//
// See docs/LEGACY_MODULE.md §"Feature set — Tier 1" for framing.

export interface DiaryIngestInput {
  photo: CapturedPhoto;
  author: EnteredBy;
  /** When the page was written. Defaults to today. */
  entry_date?: string;
  /** Optional title; auto-generated from date if omitted. */
  title?: string;
  /** OCR runner — injectable for testing. */
  runOcr?: (blob: Blob) => Promise<{ text: string; confidence: number }>;
}

export interface DiaryIngestResult {
  life_event_id: number;
  media_id: number;
  ocr_text?: string;
  ocr_confidence?: number;
}

export async function ingestDiaryPage(
  input: DiaryIngestInput,
): Promise<DiaryIngestResult> {
  const entry_date = input.entry_date ?? today();
  const title = input.title ?? `Diary — ${entry_date}`;
  const createdAt = now();

  const row: LifeEvent = {
    title,
    event_date: entry_date,
    category: "diary",
    is_memory: true,
    author: input.author,
    created_via: "manual",
    created_at: createdAt,
    updated_at: createdAt,
  };
  const life_event_id = (await db.life_events.add(row)) as number;

  const media_id = await attachMedia({
    owner_type: "life_event",
    owner_id: life_event_id,
    captured: input.photo,
    created_by: input.author,
  });

  let ocr_text: string | undefined;
  let ocr_confidence: number | undefined;
  if (input.runOcr) {
    try {
      const r = await input.runOcr(input.photo.blob);
      ocr_text = r.text.trim();
      ocr_confidence = r.confidence;
      if (ocr_text) {
        await db.life_events.update(life_event_id, {
          notes: ocr_text,
          updated_at: now(),
        });
      }
    } catch {
      // OCR is best-effort — the photo is preserved regardless.
      ocr_text = undefined;
      ocr_confidence = undefined;
    }
  }

  return { life_event_id, media_id, ocr_text, ocr_confidence };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
