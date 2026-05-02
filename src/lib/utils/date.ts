import { format, parseISO } from "date-fns";

export type Locale = "en" | "zh";

// Two-digit zero-padding helper. Used by every other formatter in this
// module — keeps callers from re-introducing String(...).padStart(2, "0")
// inline.
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Format a `Date` (any) as YYYY-MM-DD using its *local* date parts. The
// ISO-string variants (`localDayISO`, `isoDatePart`) below are the same
// idea expressed against a string input.
export function formatLocalDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return formatLocalDateISO(new Date());
}

// Current instant as a UTC ISO string. The de-facto wire format for
// `created_at`/`updated_at`/`at` columns and any timestamp written
// through Dexie or Supabase. Centralised so a future move to a clock
// abstraction (or fixed-clock testing) only touches one site.
export function nowISO(): string {
  return new Date().toISOString();
}

// Return the YYYY-MM-DD prefix of any ISO datetime string. Used widely for
// keying dailies/meals/appointments by calendar date.
export function isoDatePart(iso: string): string {
  return iso.slice(0, 10);
}

// Local-time YYYY-MM-DD for an ISO timestamp. Use this when the day
// must reflect the patient's wall clock — e.g. a memo recorded at
// 23:50 AEST should belong to that evening's diary, not tomorrow's
// UTC date.
export function localDayISO(iso: string): string {
  return formatLocalDateISO(new Date(iso));
}

// Shift a YYYY-MM-DD date by N (positive or negative) calendar days using
// local-zone arithmetic. Replaces the half-dozen `defaultFrom`/`prevDay`/
// `daysAgo`/`isoDaysAgo` helpers that duplicated the same Date+setDate
// dance.
export function shiftDateISO(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return formatLocalDateISO(d);
}

// Local "HH:MM" for a Date — the value an `<input type="time">` element
// expects.
export function formatHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Current local time as "HH:MM".
export function currentHHMM(): string {
  return formatHHMM(new Date());
}

// Render an ISO timestamp as the offset-free shape `<input
// type="datetime-local">` requires: "YYYY-MM-DDTHH:MM". Returns "" for
// missing or unparseable inputs so callers can drop their own
// Number.isNaN guards.
export function toDatetimeLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatLocalDateISO(d)}T${formatHHMM(d)}`;
}

// Format milliseconds as "m:ss" (no leading zero on minutes — voice memo
// playback / recording convention).
export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${pad2(secs)}`;
}

// Format a number of seconds as "mm:ss" (zero-padded minutes — countdown
// timer convention).
export function formatClockSeconds(seconds: number): string {
  const abs = Math.max(0, Math.round(seconds));
  return `${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

// ISO 8601 week key in "YYYY-Www" form — used by detectors that dedupe
// signals to one per week. Pulled out of two near-identical detector
// helpers to keep the week math in one place.
export function isoWeekKey(iso: string): string {
  const d = new Date(iso);
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNr =
    1 +
    Math.round(
      ((target.valueOf() - firstThursday.valueOf()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${pad2(weekNr)}`;
}

// Shift an ISO datetime string by N UTC days, preserving the time-of-day
// component.
export function shiftIsoDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// BCP-47 language tag for the patient's locale. Centralised so the zh-CN /
// en-AU mapping isn't repeated across every component that calls
// toLocaleDateString / toLocaleTimeString.
export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-AU";
}

export function formatDate(iso: string, locale: Locale = "en"): string {
  const d = parseISO(iso);
  if (locale === "zh") {
    return format(d, "yyyy年MM月dd日");
  }
  return format(d, "dd/MM/yyyy");
}

export function formatDateTime(iso: string, locale: Locale = "en"): string {
  const d = parseISO(iso);
  if (locale === "zh") {
    return format(d, "yyyy年MM月dd日 HH:mm");
  }
  return format(d, "dd/MM/yyyy HH:mm");
}
