import type { Locale } from "./clinical";
import type { PhaseKey } from "./treatment";

export type TaskCategory =
  | "environmental"
  | "dental"
  | "nutrition"
  | "pharmacy"
  | "physio"
  | "clinical"
  | "admin"
  | "vaccine"
  | "self_care"
  | "household"
  | "other";

export type TaskPriority = "low" | "normal" | "high";

export type TaskScheduleKind =
  | "once"
  | "recurring"
  | "cycle_day"
  | "cycle_phase";

export type CyclePhaseKey = PhaseKey;

export interface TaskCompletion {
  date: string;
  note?: string;
}

export interface PatientTask {
  id?: number;
  title: string;
  title_zh?: string;
  notes?: string;
  category: TaskCategory;
  priority: TaskPriority;

  schedule_kind: TaskScheduleKind;

  // schedule_kind = "once" or "recurring"
  due_date?: string;
  // schedule_kind = "recurring"
  recurrence_interval_days?: number;

  // schedule_kind = "cycle_day" — trigger on a specific cycle day number
  cycle_day?: number;
  // schedule_kind = "cycle_phase"
  cycle_phase?: CyclePhaseKey;

  // How many days before due_date the task should appear on the dashboard
  lead_time_days: number;

  last_completed_date?: string;
  completions?: TaskCompletion[];

  // If the user snoozes, hide until this date
  snoozed_until?: string;

  surface_dashboard: boolean;
  surface_daily: boolean;

  active: boolean;

  // Optional provenance — which preset id this came from (for upgrade paths)
  preset_id?: string;

  created_at: string;
  updated_at: string;
}

export type TaskBucket =
  | "overdue"
  | "due_today"
  | "approaching"
  | "cycle_relevant"
  | "snoozed"
  | "scheduled";

export interface TaskInstance {
  task: PatientTask;
  bucket: TaskBucket;
  due_on: string; // YYYY-MM-DD (next occurrence)
  days_until_due: number; // negative if overdue
  reason?: string; // e.g. "Nadir day — peak infection risk"
}

export interface TaskPreset {
  id: string;
  title: { en: string; zh: string };
  category: TaskCategory;
  notes?: { en: string; zh: string };
  schedule_kind: TaskScheduleKind;
  recurrence_interval_days?: number;
  cycle_day?: number;
  cycle_phase?: CyclePhaseKey;
  lead_time_days: number;
  priority: TaskPriority;
  default_due_offset_days?: number; // for one-off, set due N days from now
  rationale: { en: string; zh: string };
}

export function localizedTitle(task: PatientTask, locale: Locale): string {
  if (locale === "zh" && task.title_zh) return task.title_zh;
  return task.title;
}
