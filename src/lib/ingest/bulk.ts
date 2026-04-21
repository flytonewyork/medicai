"use client";

import { ocrFile } from "./ocr";
import { parseHeuristic } from "./heuristic-parser";
import { extractWithClaude } from "./claude-parser";
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
  extraction?: UnifiedExtraction;
  method?: "heuristic" | "claude";
  documentId?: number;
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
  method: "heuristic" | "claude",
  apiKey: string | undefined,
  mutate: BulkMutator,
): Promise<void> {
  if (!item.ocrText || !item.documentId) return;
  mutate(item.id, { status: "parsing", method });
  try {
    let extraction: UnifiedExtraction;
    if (method === "claude" && apiKey) {
      const claudeOut = await extractWithClaude({
        apiKey,
        text: item.ocrText,
      });
      extraction = fromClaude(claudeOut);
    } else {
      extraction = fromHeuristic(parseHeuristic(item.ocrText));
    }
    await db.ingested_documents.update(item.documentId, {
      extraction_method: method,
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
