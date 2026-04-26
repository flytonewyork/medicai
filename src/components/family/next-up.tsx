"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import type { Appointment, AppointmentKind } from "~/types/appointment";
import { activeFast, hasActivePrep } from "~/lib/appointments/prep";
import {
  Stethoscope,
  Syringe,
  ScanLine,
  Droplet,
  ClipboardList,
  Sparkles,
  ChevronRight,
  MapPin,
  Check,
  HelpCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Calm, two-or-three-item strip of what's coming up in the next seven
// days. Location is tappable if we have a URL; attendee chips show who
// is (or is planning to be) there. This is the surface that closes the
// "when is dad's PET CT?" coordination gap.

const KIND_ICON: Record<
  AppointmentKind,
  React.ComponentType<{ className?: string }>
> = {
  clinic: Stethoscope,
  chemo: Syringe,
  scan: ScanLine,
  blood_test: Droplet,
  procedure: ClipboardList,
  other: Sparkles,
};

const KIND_TONE: Record<AppointmentKind, string> = {
  clinic: "bg-paper-2 text-ink-700",
  chemo: "bg-[var(--tide-soft)] text-[var(--tide-2)]",
  scan: "bg-[var(--sand)] text-ink-900",
  blood_test: "bg-[var(--warn-soft)] text-[var(--warn)]",
  procedure: "bg-ink-100 text-ink-900",
  other: "bg-ink-100 text-ink-700",
};

export function NextUp() {
  const locale = useLocale();
  const appointments = useLiveQuery(
    () => db.appointments.orderBy("starts_at").toArray(),
    [],
  );

  const upcoming = useMemo(() => {
    const list = appointments ?? [];
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    return list
      .filter((a) => {
        if (a.status === "cancelled") return false;
        const t = new Date(a.starts_at).getTime();
        return Number.isFinite(t) && t >= now && t < sevenDays;
      })
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )
      .slice(0, 3);
  }, [appointments]);

  if (!appointments) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="eyebrow">{locale === "zh" ? "接下来" : "Next up"}</h2>
        <Link
          href="/schedule"
          className="text-[11.5px] text-ink-500 hover:text-ink-900"
        >
          {locale === "zh" ? "全部日程" : "All"}
          <ChevronRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper-2 p-4 text-center text-[12.5px] text-ink-500">
          {locale === "zh"
            ? "未来七天暂无预约。"
            : "Nothing scheduled in the next seven days."}
        </div>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((a) => (
            <li key={a.id}>
              <Row appt={a} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ appt, locale }: { appt: Appointment; locale: "en" | "zh" }) {
  const Icon = KIND_ICON[appt.kind];
  const when = formatWhen(appt, locale);
  // Slice F: prefer structured attendance with status colours; fall
  // back to doctor / freetext attendees as pending chips.
  const attendanceChips = (appt.attendance ?? []).map((a) => ({
    label: a.name,
    status: a.status as "confirmed" | "tentative" | "declined",
  }));
  const pendingNames = [
    ...(appt.doctor ? [appt.doctor] : []),
    ...(appt.attendees ?? []),
  ].filter(
    (n) =>
      !attendanceChips.some(
        (a) => a.label.trim().toLowerCase() === n.trim().toLowerCase(),
      ),
  );
  const chips = [
    ...attendanceChips,
    ...pendingNames.map((n) => ({ label: n, status: "pending" as const })),
  ];
  return (
    <Link
      href={`/schedule/${appt.id}`}
      className="block rounded-[var(--r-md)] border border-ink-100 bg-paper-2 p-3 hover:border-ink-300"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            KIND_TONE[appt.kind],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[14px] font-semibold text-ink-900">
              {appt.title}
            </div>
            {hasActivePrep(appt) && (
              <span className="mono shrink-0 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--warn)]">
                {activeFast(appt) ? "Fasting now" : "Prep now"}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-500">{when}</div>
          {(appt.location || appt.location_url) && (
            <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-600">
              <MapPin className="h-3 w-3" />
              {appt.location_url ? (
                <a
                  href={appt.location_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="underline hover:text-ink-900"
                >
                  {appt.location ?? appt.location_url}
                </a>
              ) : (
                <span>{appt.location}</span>
              )}
            </div>
          )}
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((c, i) => {
                const tone =
                  c.status === "confirmed"
                    ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                    : c.status === "tentative"
                      ? "bg-[var(--sand)] text-ink-900"
                      : c.status === "declined"
                        ? "bg-ink-100 text-ink-400 line-through"
                        : "bg-ink-100 text-ink-700";
                const StatusIcon =
                  c.status === "confirmed"
                    ? Check
                    : c.status === "tentative"
                      ? HelpCircle
                      : null;
                return (
                  <span
                    key={`${c.label}-${i}`}
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                      tone
                    }
                  >
                    {StatusIcon && (
                      <StatusIcon className="h-3 w-3" aria-hidden />
                    )}
                    {c.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
      </div>
    </Link>
  );
}

function formatWhen(appt: Appointment, locale: "en" | "zh"): string {
  const d = new Date(appt.starts_at);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const apptDay = new Date(d);
  apptDay.setHours(0, 0, 0, 0);

  let dayLabel: string;
  if (apptDay.getTime() === today.getTime()) {
    dayLabel = locale === "zh" ? "今天" : "Today";
  } else if (apptDay.getTime() === tomorrow.getTime()) {
    dayLabel = locale === "zh" ? "明天" : "Tomorrow";
  } else {
    dayLabel = d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-AU", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }
  if (appt.all_day) return dayLabel;
  const timeLabel = d.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dayLabel} · ${timeLabel}`;
}
