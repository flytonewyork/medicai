import { format, parseISO } from "date-fns";

export const MS_PER_DAY = 86_400_000;

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Convert an ISO date or datetime to epoch-day (UTC midnight buckets).
// Returns NaN for inputs Date.parse can't handle.
export function toEpochDays(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.floor(t / MS_PER_DAY);
}

export function isoFromEpochDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function formatDate(iso: string, locale: "en" | "zh" = "en"): string {
  const d = parseISO(iso);
  if (locale === "zh") {
    return format(d, "yyyy年MM月dd日");
  }
  return format(d, "dd/MM/yyyy");
}

export function formatDateTime(iso: string, locale: "en" | "zh" = "en"): string {
  const d = parseISO(iso);
  if (locale === "zh") {
    return format(d, "yyyy年MM月dd日 HH:mm");
  }
  return format(d, "dd/MM/yyyy HH:mm");
}
