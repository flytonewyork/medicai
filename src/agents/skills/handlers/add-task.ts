import { db, now } from "~/lib/db/dexie";
import type { PatientTask, TaskCategory } from "~/types/task";

export interface AddTaskInput {
  title: string;
  due_date?: string;
  category?: string;
  notes?: string;
}

export interface AddTaskOutput {
  ok: boolean;
  id?: number;
  title: string;
  error?: string;
}

const VALID_CATEGORIES: readonly TaskCategory[] = [
  "environmental",
  "dental",
  "nutrition",
  "pharmacy",
  "physio",
  "clinical",
  "admin",
  "vaccine",
  "self_care",
  "household",
  "other",
];

function coerceCategory(raw: string | undefined): TaskCategory {
  if (!raw) return "other";
  const lower = raw.toLowerCase();
  return (VALID_CATEGORIES as readonly string[]).includes(lower)
    ? (lower as TaskCategory)
    : "other";
}

export async function addTaskHandler(
  input: AddTaskInput,
): Promise<AddTaskOutput> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, title: "", error: "empty_title" };
  }
  const ts = now();
  const row: PatientTask = {
    title,
    notes: input.notes?.trim() || undefined,
    category: coerceCategory(input.category),
    priority: "normal",
    schedule_kind: input.due_date ? "once" : "once",
    due_date: input.due_date,
    lead_time_days: 3,
    surface_dashboard: true,
    surface_daily: false,
    active: true,
    created_at: ts,
    updated_at: ts,
  };
  const id = (await db.patient_tasks.add(row)) as number;
  return { ok: true, id, title };
}
