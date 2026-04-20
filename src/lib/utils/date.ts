import { format, parseISO } from "date-fns";

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
