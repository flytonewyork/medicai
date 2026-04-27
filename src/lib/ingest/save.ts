import { db, now } from "~/lib/db/dexie";
import { runEngineAndPersist } from "~/lib/rules/engine";
import { todayISO } from "~/lib/utils/date";
import type {
  IngestedDocument,
  IngestedDocumentKind,
  LabResult,
  PendingResult,
} from "~/types/clinical";
import type { ParsedExtraction } from "./heuristic-parser";
import type { ClaudeExtraction } from "./claude-parser";

export interface SaveResult {
  labsId?: number;
  imagingId?: number;
  ctdnaId?: number;
  pendingIds: number[];
}

export interface UnifiedExtraction {
  kind: IngestedDocumentKind;
  document_date?: string;
  labs?: ParsedExtraction["labs"];
  imaging?: ParsedExtraction["imaging"];
  ctdna?: ParsedExtraction["ctdna"];
  summary?: string;
  pending_items?: Array<{ test_name: string; category: PendingResult["category"] }>;
}

export function fromHeuristic(p: ParsedExtraction): UnifiedExtraction {
  const kind: IngestedDocumentKind = p.labs
    ? "lab_report"
    : p.imaging
      ? "imaging_report"
      : p.ctdna
        ? "ctdna_report"
        : "other";
  return {
    kind,
    document_date: p.document_date,
    labs: p.labs,
    imaging: p.imaging,
    ctdna: p.ctdna,
  };
}

export function fromClaude(e: ClaudeExtraction): UnifiedExtraction {
  const stripNull = <T extends object>(obj: T | null | undefined): Partial<T> | undefined => {
    if (!obj) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) out[k] = v;
    }
    return Object.keys(out).length > 0 ? (out as Partial<T>) : undefined;
  };
  return {
    kind: e.kind,
    document_date: e.document_date ?? undefined,
    labs: stripNull(e.labs) as UnifiedExtraction["labs"],
    imaging: stripNull(e.imaging) as UnifiedExtraction["imaging"],
    ctdna: stripNull(e.ctdna) as UnifiedExtraction["ctdna"],
    summary: e.summary,
    pending_items: e.pending_items,
  };
}

export async function saveExtraction(
  doc: IngestedDocument,
  extraction: UnifiedExtraction,
): Promise<SaveResult> {
  const result: SaveResult = { pendingIds: [] };
  const ts = now();

  if (extraction.labs && Object.keys(extraction.labs).length > 0) {
    const labRow: LabResult = {
      date: extraction.document_date ?? todayISO(),
      source: "external",
      notes: extraction.summary,
      ...extraction.labs,
      created_at: ts,
      updated_at: ts,
    };
    result.labsId = (await db.labs.add(labRow)) as number;
  }

  if (extraction.imaging && extraction.imaging.modality) {
    const imgId = await db.imaging.add({
      date: extraction.imaging.date ?? extraction.document_date ?? todayISO(),
      modality: extraction.imaging.modality,
      findings_summary:
        extraction.imaging.findings_summary ?? extraction.summary ?? "",
      recist_status: extraction.imaging.recist_status,
      created_at: ts,
      updated_at: ts,
    });
    result.imagingId = imgId as number;
  }

  if (extraction.ctdna) {
    const ctId = await db.ctdna_results.add({
      date: extraction.ctdna.date ?? extraction.document_date ?? todayISO(),
      platform: extraction.ctdna.platform ?? "other",
      detected: extraction.ctdna.detected ?? false,
      value: extraction.ctdna.value,
      notes: extraction.summary,
      created_at: ts,
      updated_at: ts,
    });
    result.ctdnaId = ctId as number;
  }

  for (const item of extraction.pending_items ?? []) {
    const pid = await db.pending_results.add({
      test_name: item.test_name,
      category: item.category,
      ordered_date: todayISO(),
      received: false,
      created_at: ts,
      updated_at: ts,
    });
    result.pendingIds.push(pid as number);
  }

  if (doc.id) {
    const linked_result_table =
      result.labsId !== undefined
        ? "labs"
        : result.imagingId !== undefined
          ? "imaging"
          : result.ctdnaId !== undefined
            ? "ctdna_results"
            : undefined;
    const linked_result_id =
      result.labsId ?? result.imagingId ?? result.ctdnaId;
    await db.ingested_documents.update(doc.id, {
      status: "saved",
      extracted_payload: extraction as unknown as Record<string, unknown>,
      linked_result_table,
      linked_result_id,
      source_document_date: extraction.document_date,
      updated_at: ts,
    });
  }

  await runEngineAndPersist();
  return result;
}

