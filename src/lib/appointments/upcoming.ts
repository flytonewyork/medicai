// Centralised "filter & sort upcoming appointments" helper. Several
// dashboard / family / log surfaces had grown copy-pasted variants of
// the same pipeline (parse starts_at → drop cancelled/missed → keep
// rows in window → sort ascending). Extracting this here keeps the
// time-arithmetic and status filter in one place; call sites declare
// the window they want and stay focused on rendering.

export interface AppointmentLike {
  starts_at: string;
  status?: string | null;
}

const DEFAULT_EXCLUDED_STATUSES: ReadonlyArray<string> = ["cancelled"];

export interface UpcomingOptions {
  /** Inclusive lower bound (ms). Default: Date.now(). */
  from?: number;
  /** Exclusive upper bound (ms). Default: +Infinity. */
  until?: number;
  /** Statuses to drop. Default: ["cancelled"]. */
  excludeStatuses?: ReadonlyArray<string>;
}

export function upcomingAppointments<T extends AppointmentLike>(
  rows: ReadonlyArray<T>,
  options: UpcomingOptions = {},
): T[] {
  const fromMs = options.from ?? Date.now();
  const untilMs = options.until ?? Number.POSITIVE_INFINITY;
  const exclude = options.excludeStatuses ?? DEFAULT_EXCLUDED_STATUSES;
  return rows
    .filter((a) => !exclude.includes(a.status ?? ""))
    .map((a) => ({ a, t: new Date(a.starts_at).getTime() }))
    .filter(({ t }) => Number.isFinite(t) && t >= fromMs && t < untilMs)
    .sort((x, y) => x.t - y.t)
    .map(({ a }) => a);
}

export function nextAppointment<T extends AppointmentLike>(
  rows: ReadonlyArray<T>,
  options?: UpcomingOptions,
): T | null {
  return upcomingAppointments(rows, options)[0] ?? null;
}
