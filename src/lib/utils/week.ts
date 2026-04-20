import { startOfWeek, addDays, format, parseISO } from "date-fns";

export function weekStartISO(date: Date = new Date()): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return format(start, "yyyy-MM-dd");
}

export function weekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
}

export function formatWeekRange(
  weekStart: string,
  locale: "en" | "zh" = "en",
): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  if (locale === "zh") {
    return `${format(start, "M月d日")} – ${format(end, "M月d日")}`;
  }
  return `${format(start, "d MMM")} – ${format(end, "d MMM")}`;
}
