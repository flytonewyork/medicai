import type { Appointment, AppointmentKind } from "~/types/appointment";
import type { PatientTask } from "~/types/task";
import type { LogTag } from "~/types/agent";

// Pure helper: given past appointments (and the current time), emit the
// follow-up tasks we'd like the patient or Thomas to complete.
//
// Rules, per appointment kind:
//  - clinic    → "Log what was discussed with {doctor}"  (due same day)
//  - blood_test → "Check / chase results"                (due +3 d)
//  - scan       → "Check scan results"                    (due +5 d)
//  - chemo      → "Log how this cycle landed"             (due same day)
//  - procedure  → "Post-procedure recovery note"          (due +1 d)
//  - other      → "Note what happened"                    (due same day)
//
// Appointments with `followup_logged_at` set are skipped (the task was
// already satisfied). Appointments whose `status` is `cancelled` or
// `rescheduled` are skipped. Appointments in the future are skipped.
// Appointments whose `starts_at` is older than `maxLookbackDays` (default
// 14) are skipped — stale follow-ups stop nagging.
//
// Returned tasks carry a synthetic negative id so they never collide with
// real Dexie task rows, and they reference the source appointment via
// `derived_from_appointment_id` so the UI's "Log follow-up" button can
// write back to the right row.

export interface DeriveFollowUpTasksArgs {
  appointments: readonly Appointment[];
  now?: Date;
  maxLookbackDays?: number;
}

export interface DerivedFollowUpTask extends PatientTask {
  derived_from_appointment_id: number;
  appointment_kind: AppointmentKind;
  log_tags: LogTag[];
}

interface KindTemplate {
  title_en: (a: Appointment) => string;
  title_zh: (a: Appointment) => string;
  offset_days: number;
  log_tags: LogTag[];
  category: PatientTask["category"];
}

const TEMPLATES: Record<AppointmentKind, KindTemplate> = {
  clinic: {
    title_en: (a) =>
      a.doctor
        ? `Log what was discussed with ${a.doctor}`
        : `Log what was discussed at clinic`,
    title_zh: (a) =>
      a.doctor ? `记录与 ${a.doctor} 的就诊内容` : `记录本次就诊内容`,
    offset_days: 0,
    log_tags: ["treatment", "mental"],
    category: "clinical",
  },
  blood_test: {
    title_en: () => `Check blood test results / chase if not back`,
    title_zh: () => `查看血液化验结果，未出则跟进`,
    offset_days: 3,
    log_tags: ["labs"],
    category: "clinical",
  },
  scan: {
    title_en: () => `Check scan results`,
    title_zh: () => `查看影像结果`,
    offset_days: 5,
    log_tags: ["tumour"],
    category: "clinical",
  },
  chemo: {
    title_en: () => `Log how this cycle landed (toxicity, energy)`,
    title_zh: () => `记录本轮化疗反应（毒性、精力）`,
    offset_days: 0,
    log_tags: ["treatment"],
    category: "clinical",
  },
  procedure: {
    title_en: (a) => `Post-procedure recovery note: ${a.title}`,
    title_zh: (a) => `术后恢复记录：${a.title}`,
    offset_days: 1,
    log_tags: ["symptom", "treatment"],
    category: "clinical",
  },
  other: {
    title_en: (a) => `Note what happened: ${a.title}`,
    title_zh: (a) => `记下当时情况：${a.title}`,
    offset_days: 0,
    log_tags: ["symptom"],
    category: "admin",
  },
};

export function logTagsForKind(kind: AppointmentKind): LogTag[] {
  return TEMPLATES[kind].log_tags;
}

export function deriveFollowUpTasks(
  args: DeriveFollowUpTasksArgs,
): DerivedFollowUpTask[] {
  const now = args.now ?? new Date();
  const lookback = args.maxLookbackDays ?? 14;
  const nowTime = now.getTime();
  const cutoff = nowTime - lookback * 24 * 60 * 60 * 1000;

  const out: DerivedFollowUpTask[] = [];
  for (const appt of args.appointments) {
    if (typeof appt.id !== "number") continue;
    if (appt.status === "cancelled" || appt.status === "rescheduled") continue;
    if (appt.followup_logged_at) continue;

    const startTime = new Date(appt.starts_at).getTime();
    if (!Number.isFinite(startTime)) continue;
    if (startTime > nowTime) continue;   // future — prep handles this
    if (startTime < cutoff) continue;    // stale — stop nagging

    const tpl = TEMPLATES[appt.kind];
    const due = new Date(startTime);
    due.setUTCDate(due.getUTCDate() + tpl.offset_days);
    const dueDate = due.toISOString().slice(0, 10);

    out.push({
      id: -10000 - appt.id,
      title: tpl.title_en(appt),
      title_zh: tpl.title_zh(appt),
      category: tpl.category,
      priority: appt.kind === "chemo" || appt.kind === "scan" ? "high" : "normal",
      schedule_kind: "once",
      due_date: dueDate,
      lead_time_days: 0,
      active: true,
      surface_dashboard: true,
      surface_daily: false,
      notes: appt.location,
      created_at: appt.updated_at,
      updated_at: appt.updated_at,
      derived_from_appointment_id: appt.id,
      appointment_kind: appt.kind,
      log_tags: tpl.log_tags,
    });
  }

  out.sort((a, b) => {
    const ad = a.due_date ?? "";
    const bd = b.due_date ?? "";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
  return out;
}
