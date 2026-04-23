import { db } from "~/lib/db/dexie";
import type { Appointment, AppointmentKind } from "~/types/appointment";

export interface ReadAppointmentsInput {
  kind?: AppointmentKind;
  include_past?: boolean;
  limit?: number;
}

export interface ReadAppointmentsOutput {
  rows: Array<
    Pick<
      Appointment,
      | "id"
      | "kind"
      | "title"
      | "starts_at"
      | "ends_at"
      | "location"
      | "doctor"
      | "status"
      | "cycle_id"
    >
  >;
  total_matched: number;
}

export async function readAppointmentsHandler(
  input: ReadAppointmentsInput,
): Promise<ReadAppointmentsOutput> {
  const limit = Math.min(30, Math.max(1, input.limit ?? 5));
  const nowMs = Date.now();
  const thirtyDaysAgoMs = nowMs - 30 * 86_400_000;

  let rows = (await db.appointments.orderBy("starts_at").toArray())
    .filter((a) => a.status !== "cancelled")
    .filter((a) => {
      const t = new Date(a.starts_at).getTime();
      if (!Number.isFinite(t)) return false;
      if (input.include_past) return t >= thirtyDaysAgoMs;
      return t >= nowMs;
    });
  if (input.kind) rows = rows.filter((a) => a.kind === input.kind);

  const shaped = rows.slice(0, limit).map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    location: a.location,
    doctor: a.doctor,
    status: a.status,
    cycle_id: a.cycle_id,
  }));
  return { rows: shaped, total_matched: rows.length };
}
