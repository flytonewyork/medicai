import { db } from "~/lib/db/dexie";
import type { LabResult } from "~/types/clinical";

export interface ReadLabsInput {
  analyte?: string;
  since?: string;
  until?: string;
  limit?: number;
}

export interface ReadLabsOutput {
  rows: Array<Partial<LabResult> & { id?: number; date: string }>;
  total_matched: number;
}

export async function readLabsHandler(
  input: ReadLabsInput,
): Promise<ReadLabsOutput> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 10));
  let rows = await db.labs.orderBy("date").reverse().toArray();
  if (input.since) rows = rows.filter((r) => r.date >= input.since!);
  if (input.until) rows = rows.filter((r) => r.date <= input.until!);
  if (input.analyte) {
    const k = input.analyte;
    rows = rows.filter(
      (r) => (r as unknown as Record<string, unknown>)[k] !== undefined,
    );
  }
  const total = rows.length;
  const slice = rows.slice(0, limit);
  // Narrow the returned shape if an analyte was requested — the agent
  // doesn't need every field, and smaller tool results keep the prompt
  // budget happy.
  const projected = input.analyte
    ? slice.map((r) => ({
        id: r.id,
        date: r.date,
        source: r.source,
        [input.analyte!]: (r as unknown as Record<string, unknown>)[
          input.analyte!
        ],
      }))
    : slice;
  return { rows: projected as ReadLabsOutput["rows"], total_matched: total };
}
