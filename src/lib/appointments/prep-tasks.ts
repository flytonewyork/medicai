import type { Appointment, AppointmentLink } from "~/types/appointment";
import type { PatientTask } from "~/types/task";

// Pure helper: given a set of appointments and their directed prep-links,
// emit the patient_tasks we'd like to see in the reminder engine.
//
// Two patterns:
//  1) "blood test" appointment already scheduled → its row becomes the
//     task, and the task's `due_date` is the appointment's own starts_at.
//  2) No `from_id` row exists yet ("I know I need to book a blood test
//     the day before chemo but haven't booked it") — the link carries
//     an `offset_days` value and the task's due_date becomes
//     `to.starts_at - offset_days`. The task's title is a generated
//     "Book <kind>" instead.
//
// We return full PatientTask shapes with synthetic negative ids so the
// feed composer can dedupe if it already has one. The caller
// (useLiveQuery-driven) flattens these into the task list.

export interface DerivePrepTasksArgs {
  appointments: readonly Appointment[];
  links: readonly AppointmentLink[];
}

export interface DerivedPrepTask extends PatientTask {
  derived_from_appointment_id?: number;
  derived_from_link_id?: number;
}

export function derivePrepTasks(args: DerivePrepTasksArgs): DerivedPrepTask[] {
  const byId = new Map<number, Appointment>();
  for (const a of args.appointments) {
    if (typeof a.id === "number") byId.set(a.id, a);
  }
  const out: DerivedPrepTask[] = [];

  for (const link of args.links) {
    if (link.relation !== "prep_for") continue;
    const to = byId.get(link.to_id);
    if (!to) continue;
    const from = byId.get(link.from_id);

    const dueDate = deriveDueDate(from, to, link.offset_days);
    if (!dueDate) continue;

    const title = from
      ? `Prep: ${from.title}`
      : `Book prep for ${to.title}`;
    const titleZh = from
      ? `准备：${from.title}`
      : `为"${to.title}"预约准备项`;

    out.push({
      // Negative id so there's no chance of colliding with real Dexie rows
      // if the derived tasks ever leak into write paths. Use link.id when
      // we have it so the id is stable across re-derives.
      id: link.id ? -1 - link.id : undefined,
      title,
      title_zh: titleZh,
      category: from?.kind === "blood_test" ? "clinical" : "admin",
      priority: "high",
      schedule_kind: "once",
      due_date: dueDate,
      lead_time_days: Math.max(1, link.offset_days ?? 1),
      active: true,
      surface_dashboard: true,
      surface_daily: false,
      notes: link.notes,
      created_at: link.created_at,
      updated_at: link.created_at,
      derived_from_appointment_id: from?.id,
      derived_from_link_id: link.id,
    });
  }

  out.sort((a, b) => {
    const ad = a.due_date ?? "";
    const bd = b.due_date ?? "";
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
  return out;
}

function deriveDueDate(
  from: Appointment | undefined,
  to: Appointment,
  offsetDays: number | undefined,
): string | null {
  if (from?.starts_at) {
    return from.starts_at.slice(0, 10);
  }
  const offset = Number.isFinite(offsetDays) ? Number(offsetDays) : 1;
  const toDate = new Date(to.starts_at);
  if (Number.isNaN(toDate.getTime())) return null;
  toDate.setUTCDate(toDate.getUTCDate() - offset);
  return toDate.toISOString().slice(0, 10);
}
