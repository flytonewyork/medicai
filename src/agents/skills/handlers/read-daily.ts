import { db } from "~/lib/db/dexie";
import type { DailyEntry } from "~/types/clinical";

export interface ReadDailyInput {
  since?: string;
  until?: string;
  limit?: number;
}

export interface ReadDailyOutput {
  rows: Array<Partial<DailyEntry> & { id?: number; date: string }>;
  total_matched: number;
}

export async function readDailyHandler(
  input: ReadDailyInput,
): Promise<ReadDailyOutput> {
  const limit = Math.min(60, Math.max(1, input.limit ?? 14));
  let rows = await db.daily_entries.orderBy("date").reverse().toArray();
  if (input.since) rows = rows.filter((r) => r.date >= input.since!);
  if (input.until) rows = rows.filter((r) => r.date <= input.until!);
  return { rows: rows.slice(0, limit), total_matched: rows.length };
}
