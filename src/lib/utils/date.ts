import { format, parseISO } from "date-fns";

export type Locale = "en" | "zh";

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Return the YYYY-MM-DD prefix of any ISO datetime string. Used widely for
// keying dailies/meals/appointments by calendar date.
export function isoDatePart(iso: string): string {
  return iso.slice(0, 10);
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
