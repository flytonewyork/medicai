import type {
  Appointment,
  AppointmentPrep,
  AppointmentPrepKind,
} from "~/types/appointment";
import type { PatientTask } from "~/types/task";
import type { LocalizedText } from "~/types/localized";

// Slice I helpers. Pure functions around AppointmentPrep so the UI
// can answer three questions without duplicating clock logic:
//   1. When does this prep item become active? (for "fasting starts
//      at 1 AM" banners)
//   2. Is any prep item currently active for a given appointment?
//      (so dashboards can show a red "fasting now" banner)
//   3. Which appointments are still awaiting prep info from the
//      clinic, so the schedule can derive an outstanding task?

// Resolves the effective start timestamp for a prep item: prefer an
// explicit `starts_at`, otherwise compute from the appointment's
// start time minus `hours_before`. Returns null when we can't.
export function prepStartMs(
  appt: Pick<Appointment, "starts_at">,
  item: AppointmentPrep,
): number | null {
  if (item.starts_at) {
    const t = new Date(item.starts_at).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof item.hours_before === "number") {
    const apptT = new Date(appt.starts_at).getTime();
    if (!Number.isFinite(apptT)) return null;
    return apptT - item.hours_before * 60 * 60 * 1000;
  }
  return null;
}

// A prep item is "active" iff:
//   - it has a resolvable start time,
//   - that start time is at or before `now`,
//   - the appointment itself hasn't started yet (i.e. prep window
//     closes when the event begins),
//   - the item hasn't been manually completed.
export function isPrepActive(
  appt: Pick<Appointment, "starts_at">,
  item: AppointmentPrep,
  now: Date = new Date(),
): boolean {
  if (item.completed_at) return false;
  const start = prepStartMs(appt, item);
  if (start === null) return false;
  const nowMs = now.getTime();
  const apptMs = new Date(appt.starts_at).getTime();
  if (!Number.isFinite(apptMs)) return false;
  return start <= nowMs && nowMs < apptMs;
}

// "Has anything been asked of the patient right now?" — the
// signal the ScheduleCard / NextUp banner consults.
export function hasActivePrep(
  appt: Pick<Appointment, "starts_at" | "prep">,
  now: Date = new Date(),
): boolean {
  for (const item of appt.prep ?? []) {
    if (isPrepActive({ starts_at: appt.starts_at }, item, now)) return true;
  }
  return false;
}

// Quick accessor — the currently-active fast item, so the dashboard
// banner can carry its description ("6-hour fast, no food or drink").
export function activeFast(
  appt: Pick<Appointment, "starts_at" | "prep">,
  now: Date = new Date(),
): AppointmentPrep | null {
  for (const item of appt.prep ?? []) {
    if (item.kind !== "fast") continue;
    if (isPrepActive({ starts_at: appt.starts_at }, item, now)) return item;
  }
  return null;
}

// Prep items default-sorted for the detail page: active-now first,
// then scheduled-soon, then items without a time. Completed items
// drift to the bottom.
export function sortPrepForRender(
  appt: Pick<Appointment, "starts_at" | "prep">,
  now: Date = new Date(),
): AppointmentPrep[] {
  const items = [...(appt.prep ?? [])];
  const nowMs = now.getTime();
  return items.sort((a, b) => {
    const aDone = Boolean(a.completed_at);
    const bDone = Boolean(b.completed_at);
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aActive = isPrepActive({ starts_at: appt.starts_at }, a, now);
    const bActive = isPrepActive({ starts_at: appt.starts_at }, b, now);
    if (aActive !== bActive) return aActive ? -1 : 1;
    const aStart = prepStartMs({ starts_at: appt.starts_at }, a);
    const bStart = prepStartMs({ starts_at: appt.starts_at }, b);
    if (aStart === null && bStart === null) return 0;
    if (aStart === null) return 1;
    if (bStart === null) return -1;
    return Math.abs(aStart - nowMs) - Math.abs(bStart - nowMs);
  });
}

// Derive "awaiting prep info" tasks. Appointments flagged
// `prep_info_received === false` in the future emit a task "Get prep
// info for <title> from <doctor>". Returns synthetic task rows with
// negative ids so they never collide with real patient_tasks.
export interface AwaitingPrepTask extends PatientTask {
  derived_from_appointment_id: number;
}

export function deriveAwaitingPrepTasks(args: {
  appointments: readonly Appointment[];
  now?: Date;
}): AwaitingPrepTask[] {
  const now = (args.now ?? new Date()).getTime();
  const out: AwaitingPrepTask[] = [];
  for (const appt of args.appointments) {
    if (typeof appt.id !== "number") continue;
    if (appt.prep_info_received !== false) continue;
    if (appt.status === "cancelled" || appt.status === "rescheduled") continue;
    const t = new Date(appt.starts_at).getTime();
    if (!Number.isFinite(t) || t < now) continue;

    const who = appt.doctor || "the clinic";
    out.push({
      id: -20000 - appt.id,
      title: `Get prep info for ${appt.title} from ${who}`,
      title_zh: `向 ${who} 索取《${appt.title}》前的准备事项`,
      category: "admin",
      priority: appt.kind === "chemo" ? "high" : "normal",
      schedule_kind: "once",
      due_date: appt.starts_at.slice(0, 10),
      lead_time_days: 0,
      active: true,
      surface_dashboard: true,
      surface_daily: false,
      created_at: appt.created_at,
      updated_at: appt.updated_at,
      derived_from_appointment_id: appt.id,
    });
  }
  out.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  return out;
}

// Small label helpers for the UI.
export const PREP_KIND_LABEL: Record<
  AppointmentPrepKind,
  LocalizedText
> = {
  fast: { en: "Fast", zh: "禁食" },
  medication_hold: { en: "Hold medication", zh: "停药" },
  medication_take: { en: "Take medication", zh: "服药" },
  arrive_early: { en: "Arrive early", zh: "提前到场" },
  bring: { en: "Bring", zh: "携带" },
  sample: { en: "Sample", zh: "标本" },
  transport: { en: "Transport", zh: "交通安排" },
  companion: { en: "Companion", zh: "陪同" },
  consent: { en: "Consent", zh: "知情同意" },
  pre_scan_contrast: { en: "Contrast", zh: "造影剂" },
  other: { en: "Other", zh: "其他" },
};
