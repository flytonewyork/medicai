import { db, now } from "~/lib/db/dexie";
import type { DirectFileResult } from "./direct-file";
import type { DailyEntry, LabResult } from "~/types/clinical";
import type { EnteredBy } from "~/types/clinical";

// Writes a direct-file result to the right Dexie table. Returns the row id
// so the /log confirmation card can link to the detail page. Distinct from
// the full /labs or /daily wizard — this is the "I just want it recorded"
// path.

export interface DirectFileApplied {
  kind: DirectFileResult["kind"];
  id: number;
}

export async function applyDirectFile(
  r: DirectFileResult,
  enteredBy: EnteredBy,
): Promise<DirectFileApplied> {
  const ts = now();
  if (r.kind === "lab") {
    // Merge into an existing same-day patient-self-report row so repeated
    // entries on the same morning don't create ghosts. Otherwise insert.
    const existing = await db.labs
      .where("date")
      .equals(r.date)
      .filter((l) => l.source === "patient_self_report")
      .first();
    if (existing?.id) {
      await db.labs.update(existing.id, {
        ...r.patch,
        updated_at: ts,
      });
      return { kind: "lab", id: existing.id };
    }
    const id = (await db.labs.add({
      ...(r.patch as LabResult),
      created_at: ts,
      updated_at: ts,
    })) as number;
    return { kind: "lab", id };
  }

  // daily: upsert today's row so partial patches accumulate.
  const existing = await db.daily_entries
    .where("date")
    .equals(r.date)
    .first();
  if (existing?.id) {
    await db.daily_entries.update(existing.id, {
      ...r.patch,
      updated_at: ts,
    });
    return { kind: "daily", id: existing.id };
  }
  const base: Partial<DailyEntry> = {
    ...r.patch,
    date: r.date,
    entered_by: enteredBy,
    entered_at: ts,
    created_at: ts,
    updated_at: ts,
  };
  const id = (await db.daily_entries.add(base as DailyEntry)) as number;
  return { kind: "daily", id };
}
