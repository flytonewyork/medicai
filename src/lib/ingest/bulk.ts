"use client";

import { ocrFile } from "./ocr";
import { parseHeuristic } from "./heuristic-parser";
import { extractWithClaude } from "./claude-parser";
import { prepareImageForVision, type PreparedImage } from "./image";
import {
  fromClaude,
  fromHeuristic,
  saveExtraction,
  type UnifiedExtraction,
} from "./save";
import { db, now } from "~/lib/db/dexie";
import type { IngestedDocument } from "~/types/clinical";

export type BulkItemStatus =
  | "queued"
  | "vision"
  | "ocr"
  | "ocr_failed"
  | "parsing"
  | "parse_failed"
  | "ready"
  | "saving"
  | "saved"
  | "discarded";

export interface BulkItem {
  id: string;
  file: File;
  status: BulkItemStatus;
  progress?: string;
  error?: string;
  ocrText?: string;
  ocrConfidence?: number;
  visionImage?: PreparedImage;
  extraction?: UnifiedExtraction;
  method?: "heuristic" | "claude" | "vision";
  documentId?: number;
}

function isDirectImage(file: File): boolean {
  return file.type.startsWith("image/");
}

export type BulkMutator = (
  id: string,
  patch: Partial<BulkItem>,
) => void;

export async function processBulkItemOcr(
  item: BulkItem,
  mutate: BulkMutator,
): Promise<void> {
  if (!item.file) return;
  // Create a document row up-front
  const docRow: IngestedDocument = {
    filename: item.file.name,
    mime_type: item.file.type || "application/octet-stream",
    size_bytes: item.file.size,
    kind: "other",
    uploaded_at: now(),
    status: "ocr_pending",
    created_at: now(),
    updated_at: now(),
  };
  const docId = (await db.ingested_documents.add(docRow)) as number;
  mutate(item.id, { status: "ocr", documentId: docId });

  try {
    const r = await ocrFile(item.file, (phase, p) => {
      mutate(item.id, {
        progress: `${phase} — ${Math.round((p ?? 0) * 100)}%`,
      });
    });
    await db.ingested_documents.update(docId, {
      ocr_text: r.text,
      ocr_confidence: r.confidence,
      status: "ocr_complete",
      updated_at: now(),
    });
    mutate(item.id, {
      ocrText: r.text,
      ocrConfidence: r.confidence,
      status: "parsing",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.ingested_documents.update(docId, {
      status: "error",
      error_message: msg,
      updated_at: now(),
    });
    mutate(item.id, { status: "ocr_failed", error: msg });
  }
}

export async function parseBulkItem(
  item: BulkItem,
  method: "heuristic" | "claude" | "vision",
  apiKey: string | undefined,
  mutate: BulkMutator,
): Promise<void> {
  if (!item.documentId) return;
  const canVision = method === "vision" && apiKey && item.visionImage;
  const canClaudeText = method === "claude" && apiKey && item.ocrText;
  if (!canVision && !canClaudeText && !item.ocrText) return;

  mutate(item.id, { status: "parsing", method });
  try {
    let extraction: UnifiedExtraction;
    if (canVision && item.visionImage && apiKey) {
      const claudeOut = await extractWithClaude({
        apiKey,
        image: item.visionImage,
        // Pass OCR text as an extra signal when we happen to have it
        text: item.ocrText,
      });
      extraction = fromClaude(claudeOut);
    } else if (canClaudeText && apiKey && item.ocrText) {
      const claudeOut = await extractWithClaude({
        apiKey,
        text: item.ocrText,
      });
      extraction = fromClaude(claudeOut);
    } else {
      extraction = fromHeuristic(parseHeuristic(item.ocrText ?? ""));
    }
    // Collapse "vision" to "claude" for the document provenance field —
    // the DB type is ("heuristic" | "claude") and vision IS a Claude call.
    const persistedMethod: "heuristic" | "claude" =
      method === "heuristic" ? "heuristic" : "claude";
    await db.ingested_documents.update(item.documentId, {
      extraction_method: persistedMethod,
      kind: extraction.kind,
      status: "extracted",
      updated_at: now(),
    });
    mutate(item.id, { extraction, status: "ready" });
  } catch (err) {
    mutate(item.id, {
      status: "parse_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Skip OCR entirely for image files when Claude Vision is available.
 * Prepares the image, creates the doc row, and calls Claude directly.
 */
export async function processBulkItemVision(
  item: BulkItem,
  apiKey: string,
  mutate: BulkMutator,
): Promise<void> {
  if (!item.file) return;
  if (!isDirectImage(item.file)) {
    // PDFs still go through OCR.
    return processBulkItemOcr(item, mutate);
  }

  const docRow: IngestedDocument = {
    filename: item.file.name,
    mime_type: item.file.type || "image/jpeg",
    size_bytes: item.file.size,
    kind: "other",
    uploaded_at: now(),
    status: "ocr_pending",
    created_at: now(),
    updated_at: now(),
  };
  const docId = (await db.ingested_documents.add(docRow)) as number;
  mutate(item.id, { status: "vision", documentId: docId, progress: "preparing image" });

  let prepared: PreparedImage;
  try {
    prepared = await prepareImageForVision(item.file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.ingested_documents.update(docId, {
      status: "error",
      error_message: msg,
      updated_at: now(),
    });
    mutate(item.id, { status: "ocr_failed", error: msg });
    return;
  }
  mutate(item.id, { visionImage: prepared, progress: "reading with Claude" });

  try {
    const claudeOut = await extractWithClaude({
      apiKey,
      image: prepared,
    });
    const extraction = fromClaude(claudeOut);
    await db.ingested_documents.update(docId, {
      extraction_method: "claude",
      kind: extraction.kind,
      status: "extracted",
      updated_at: now(),
    });
    mutate(item.id, {
      extraction,
      method: "vision",
      status: "ready",
      progress: undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.ingested_documents.update(docId, {
      status: "error",
      error_message: msg,
      updated_at: now(),
    });
    mutate(item.id, { status: "parse_failed", error: msg });
  }
}

/**
 * Entry point that picks the optimal pipeline for a single file.
 * - Image + apiKey → Claude Vision direct (fastest, best quality)
 * - PDF or no apiKey → OCR first, parser runs after
 */
export async function processBulkItem(
  item: BulkItem,
  apiKey: string | undefined,
  mutate: BulkMutator,
): Promise<void> {
  if (apiKey && isDirectImage(item.file)) {
    return processBulkItemVision(item, apiKey, mutate);
  }
  return processBulkItemOcr(item, mutate);
}

export async function saveBulkItem(
  item: BulkItem,
  mutate: BulkMutator,
): Promise<void> {
  if (!item.extraction || !item.documentId) return;
  const doc = await db.ingested_documents.get(item.documentId);
  if (!doc) return;
  mutate(item.id, { status: "saving" });
  try {
    await saveExtraction(doc, item.extraction);
    mutate(item.id, { status: "saved" });
  } catch (err) {
    mutate(item.id, {
      status: "parse_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
