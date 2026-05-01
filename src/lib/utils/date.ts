import { format, parseISO } from "date-fns";

export type Locale = "en" | "zh";

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
