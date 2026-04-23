import { db } from "~/lib/db/dexie";
import type { Table } from "dexie";

// Canonical "newest-first" queries for each table. Each helper fixes the
// table-to-index pairing in one place so ad-hoc callsites can't drift from
// the indexed sort key defined in dexie.ts.

function latest<T>(
  table: Table<T, number>,
  indexField: string,
  limit?: number,
): Promise<T[]> {
  const q = table.orderBy(indexField).reverse();
  return (typeof limit === "number" ? q.limit(limit) : q).toArray();
}

export const latestDailyEntries = (limit?: number) =>
  latest(db.daily_entries, "date", limit);

export const latestWeeklyAssessments = (limit?: number) =>
  latest(db.weekly_assessments, "week_start", limit);

export const latestFortnightlyAssessments = (limit?: number) =>
  latest(db.fortnightly_assessments, "assessment_date", limit);

export const latestLabs = (limit?: number) =>
  latest(db.labs, "date", limit);

export const latestTreatmentCycles = (limit?: number) =>
  latest(db.treatment_cycles, "start_date", limit);

export const latestChangeSignals = (limit?: number) =>
  latest(db.change_signals, "detected_at", limit);

export const latestPendingResults = (limit?: number) =>
  latest(db.pending_results, "ordered_date", limit);

export const latestIngestedDocuments = (limit?: number) =>
  latest(db.ingested_documents, "uploaded_at", limit);

export const latestAgentRuns = (limit?: number) =>
  latest(db.agent_runs, "ran_at", limit);
