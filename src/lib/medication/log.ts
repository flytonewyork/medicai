import { db, now } from "~/lib/db/dexie";
import type {
  Medication,
  MedicationEvent,
  MedicationTodayStatus,
  DoseSchedule,
} from "~/types/medication";
import { DRUGS_BY_ID } from "~/config/drug-registry";

/**
 * Log a single medication event (dose taken, missed, or a side-effect-only note).
 */
export async function logMedicationEvent(
  params: {
    medication: Medication;
    event_type: "taken" | "missed" | "side_effect_only";
    dose_taken?: string;
    side_effects?: string[];
    side_effect_severity?: 1 | 2 | 3 | 4 | 5;
    note?: string;
    source: "daily_checkin" | "quick_log" | "fab" | "backfill";
    logged_at?: string; // defaults to now
  },
): Promise<number> {
  if (!params.medication.id) throw new Error("medication.id required");
  const event: MedicationEvent = {
    medication_id: params.medication.id,
    drug_id: params.medication.drug_id,
    event_type: params.event_type,
    logged_at: params.logged_at ?? now(),
    dose_taken: params.dose_taken,
    side_effects: params.side_effects,
    side_effect_severity: params.side_effect_severity,
    note: params.note,
    source: params.source,
    created_at: now(),
  };
  return (await db.medication_events.add(event)) as number;
}

/**
 * Count how many scheduled doses are expected today for this medication.
 * Rules:
 *  - kind "fixed" / "with_meals"     — times_per_day (default 1)
 *  - kind "cycle_linked"            — 1 if today's cycle_day is in cycle_days
 *  - kind "prn"                     — 0 (on-demand)
 *  - kind "taper"                   — 1 per day during current taper step
 *  - kind "custom"                  — 1 (best-effort; rrule parser comes later)
 */
export function expectedDosesToday(
  schedule: DoseSchedule,
  cycleDay?: number,
): number {
  switch (schedule.kind) {
    case "fixed":
    case "with_meals":
      return schedule.times_per_day ?? 1;
    case "cycle_linked":
      if (!cycleDay || !schedule.cycle_days) return 0;
      return schedule.cycle_days.includes(cycleDay) ? 1 : 0;
    case "prn":
      return 0;
    case "taper":
    case "custom":
      return 1;
    default:
      return 0;
  }
}

/**
 * Next due clock time today for a fixed-schedule med (ISO), or undefined.
 */
export function nextDueTimeToday(
  schedule: DoseSchedule,
  nowDate: Date,
): string | undefined {
  if (
    (schedule.kind !== "fixed" && schedule.kind !== "with_meals") ||
    !schedule.clock_times ||
    schedule.clock_times.length === 0
  ) {
    return undefined;
  }
  const today = nowDate.toISOString().slice(0, 10);
  for (const t of schedule.clock_times) {
    const iso = `${today}T${t}:00`;
    if (new Date(iso).getTime() > nowDate.getTime()) return iso;
  }
  return undefined;
}

/**
 * Compile MedicationTodayStatus for every active med, given the current cycle day.
 * Consumes: all active meds + today's events.
 */
export async function compileTodayStatuses(
  medications: Medication[],
  cycleDay?: number,
  nowDate: Date = new Date(),
): Promise<MedicationTodayStatus[]> {
  const today = nowDate.toISOString().slice(0, 10);

  const todaysEvents = await db.medication_events
    .where("logged_at")
    .startsWith(today)
    .toArray();

  return medications.map((med) => {
    const drug = DRUGS_BY_ID[med.drug_id];
    const due = expectedDosesToday(med.schedule, cycleDay);
    const loggedEvents = todaysEvents.filter(
      (e) => e.medication_id === med.id && e.event_type === "taken",
    );
    const nextDue = nextDueTimeToday(med.schedule, nowDate);
    const withinNextHour = nextDue
      ? new Date(nextDue).getTime() - nowDate.getTime() <= 60 * 60 * 1000
      : false;

    return {
      medication: med,
      drug_name_en: drug?.name.en ?? med.display_name ?? med.drug_id,
      drug_name_zh: drug?.name.zh ?? med.display_name ?? med.drug_id,
      due_count: due,
      logged_count: loggedEvents.length,
      last_logged_at: loggedEvents[loggedEvents.length - 1]?.logged_at,
      is_due_now: due > 0 && (withinNextHour || loggedEvents.length < due),
      next_due_at: nextDue,
    };
  });
}

/**
 * Fetch recent events for a medication (newest first, limit N).
 */
export async function getRecentEvents(
  medicationId: number,
  limit = 20,
): Promise<MedicationEvent[]> {
  const all = await db.medication_events
    .where("medication_id")
    .equals(medicationId)
    .reverse()
    .sortBy("logged_at");
  return all.slice(0, limit);
}
