// Custom behavioural practices — Hu Lin's breathing exercises, meditation,
// walking, etc. Stored in the same `medications` table with
// `category: "behavioural"` and `source: "user_added"`. Drug_id uses a
// `custom:<slug>` namespace per docs/MEDICATIONS.md so they don't collide
// with the curated DRUG_REGISTRY.
import { db, now } from "~/lib/db/dexie";
import type {
  DoseSchedule,
  Medication,
  MedicationRoute,
  ScheduleKind,
} from "~/types/medication";
import type { LocalizedText } from "~/types/treatment";

export interface CustomPracticeInput {
  name: string;                        // display name, e.g. "Morning breathing"
  name_zh?: string;
  duration: string;                    // "20 min" / "10 breaths"
  schedule_kind: ScheduleKind;         // typically "fixed" or "custom"
  clock_times?: string[];              // ["07:00"] for fixed-schedule
  times_per_day?: number;
  rrule?: string;                      // e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR
  notes?: string;
  started_on?: string;                 // defaults to today
}

// Produce a URL-safe slug for the drug_id. Keeps it deterministic so editing
// a practice by name doesn't create orphan rows.
export function practiceSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .slice(0, 40);
  return `custom:${base || "practice"}`;
}

function scheduleFromInput(input: CustomPracticeInput): DoseSchedule {
  const schedule: DoseSchedule = {
    kind: input.schedule_kind,
    start_date: input.started_on,
  };
  if (input.schedule_kind === "fixed" || input.schedule_kind === "with_meals") {
    schedule.times_per_day = input.times_per_day ?? 1;
    if (input.clock_times?.length) schedule.clock_times = input.clock_times;
  }
  if (input.schedule_kind === "custom" && input.rrule) {
    schedule.rrule = input.rrule;
  }
  // Attach a human-readable label for display.
  schedule.label = {
    en: scheduleLabelEn(input),
    zh: scheduleLabelZh(input),
  };
  return schedule;
}

function scheduleLabelEn(input: CustomPracticeInput): string {
  if (input.schedule_kind === "fixed") {
    const n = input.times_per_day ?? 1;
    const times = input.clock_times?.join(", ");
    return times
      ? `${n}× daily at ${times}`
      : `${n}× daily`;
  }
  if (input.schedule_kind === "with_meals") {
    return `${input.times_per_day ?? 3}× daily with meals`;
  }
  if (input.schedule_kind === "custom") {
    return input.rrule ?? "Custom schedule";
  }
  return input.schedule_kind;
}

function scheduleLabelZh(input: CustomPracticeInput): string {
  if (input.schedule_kind === "fixed") {
    const n = input.times_per_day ?? 1;
    const times = input.clock_times?.join(", ");
    return times ? `每日 ${n} 次，于 ${times}` : `每日 ${n} 次`;
  }
  if (input.schedule_kind === "with_meals") {
    return `每日 ${input.times_per_day ?? 3} 次与餐同服`;
  }
  if (input.schedule_kind === "custom") {
    return input.rrule ?? "自定义计划";
  }
  return input.schedule_kind;
}

export async function createCustomPractice(
  input: CustomPracticeInput,
): Promise<number> {
  const ts = now();
  const med: Medication = {
    drug_id: practiceSlug(input.name),
    display_name: input.name,
    category: "behavioural",
    dose: input.duration,
    route: "practice" as MedicationRoute,
    schedule: scheduleFromInput(input),
    source: "user_added",
    active: true,
    notes: input.notes,
    started_on: input.started_on ?? ts.slice(0, 10),
    created_at: ts,
    updated_at: ts,
  };
  return (await db.medications.add(med)) as number;
}

export async function updateCustomPractice(
  id: number,
  input: CustomPracticeInput,
): Promise<void> {
  await db.medications.update(id, {
    drug_id: practiceSlug(input.name),
    display_name: input.name,
    dose: input.duration,
    schedule: scheduleFromInput(input),
    notes: input.notes,
    updated_at: now(),
  });
}

export async function deactivateCustomPractice(id: number): Promise<void> {
  await db.medications.update(id, {
    active: false,
    stopped_on: now(),
    updated_at: now(),
  });
}

export async function deleteCustomPractice(id: number): Promise<void> {
  await db.medications.delete(id);
}

/**
 * All active behavioural-category medications — both catalogued (qigong,
 * resistance_training) and user-added custom ones.
 */
export async function listActivePractices(): Promise<Medication[]> {
  const all = await db.medications.toArray();
  return all.filter((m) => m.category === "behavioural" && m.active);
}

export function isCustomPractice(med: Medication): boolean {
  return med.drug_id.startsWith("custom:");
}

export function scheduleSummary(
  schedule: DoseSchedule,
  locale: "en" | "zh",
): string {
  const label = schedule.label?.[locale];
  if (label) return label;
  return schedule.kind;
}

// Re-export for components that want a typed label accessor.
export type CustomPracticeLabel = LocalizedText;
