import type {
  AppointmentAttendance,
  AttendanceStatus,
} from "~/types/appointment";

// Pure reducers for the attendance array on an Appointment. Matching
// is case-insensitive on `name` so renames in the care-team registry
// don't fragment the record. A user toggling themselves between
// pending → confirmed → tentative → declined → pending is the full
// cycle the detail page drives.

export type PendingOrStatus = AttendanceStatus | "pending";

export function findAttendance(
  rows: readonly AppointmentAttendance[] | undefined,
  name: string,
): AppointmentAttendance | undefined {
  const target = name.trim().toLowerCase();
  return (rows ?? []).find((r) => r.name.trim().toLowerCase() === target);
}

export function statusFor(
  rows: readonly AppointmentAttendance[] | undefined,
  name: string,
): PendingOrStatus {
  return findAttendance(rows, name)?.status ?? "pending";
}

// Cycle order: pending → confirmed → tentative → declined → pending.
// Each tap bumps once; the UI lets the user stop where they want.
export function nextStatus(current: PendingOrStatus): PendingOrStatus {
  switch (current) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "tentative";
    case "tentative":
      return "declined";
    case "declined":
      return "pending";
  }
}

// Write the new status for a named attendee, replacing or removing any
// existing row. Returns a new array; original is untouched.
export function setAttendance(
  rows: readonly AppointmentAttendance[] | undefined,
  args: {
    name: string;
    user_id?: string;
    status: PendingOrStatus;
    now?: Date;
    note?: string;
  },
): AppointmentAttendance[] {
  const now = (args.now ?? new Date()).toISOString();
  const rest = (rows ?? []).filter(
    (r) => r.name.trim().toLowerCase() !== args.name.trim().toLowerCase(),
  );
  if (args.status === "pending") return rest;
  const next: AppointmentAttendance = {
    name: args.name.trim(),
    user_id: args.user_id,
    status: args.status,
    claimed_at: now,
    note: args.note,
  };
  return [...rest, next];
}
