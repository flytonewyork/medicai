// Helpers for reading / writing `TreatmentCycle.day_records` — the per-day
// audit trail of what actually happened (dose administered, any dose
// modification, free-form notes). The cycle page uses these from the
// clickable day-detail sheet.

import { addDays, format, parseISO } from "date-fns";
import { db, now } from "~/lib/db/dexie";
import type { CycleDoseDayRecord, TreatmentCycle } from "~/types/treatment";

export function cycleDayDate(
  startISO: string,
  dayNumber: number,
): string {
  const start = parseISO(startISO);
  return format(addDays(start, dayNumber - 1), "yyyy-MM-dd");
}

export function getDayRecord(
  cycle: TreatmentCycle,
  dayNumber: number,
): CycleDoseDayRecord | undefined {
  return (cycle.day_records ?? []).find((r) => r.day === dayNumber);
}

export async function upsertDayRecord(
  cycleId: number,
  dayNumber: number,
  patch: Partial<CycleDoseDayRecord>,
): Promise<void> {
  const cycle = await db.treatment_cycles.get(cycleId);
  if (!cycle) return;
  const date = cycleDayDate(cycle.start_date, dayNumber);
  const existing = cycle.day_records ?? [];
  const idx = existing.findIndex((r) => r.day === dayNumber);
  const base: CycleDoseDayRecord = {
    day: dayNumber,
    date,
    administered: false,
  };
  const next =
    idx === -1
      ? [...existing, { ...base, ...patch }]
      : existing.map((r, i) =>
          i === idx ? { ...base, ...r, ...patch, day: dayNumber, date } : r,
        );
  await db.treatment_cycles.update(cycleId, {
    day_records: next,
    updated_at: now(),
  });
}
