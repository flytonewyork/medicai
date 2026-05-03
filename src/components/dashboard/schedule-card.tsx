"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { deriveFollowUpTasks } from "~/lib/appointments/follow-up-tasks";
import { activeFast, hasActivePrep } from "~/lib/appointments/prep";
import type { Appointment, AppointmentKind } from "~/types/appointment";
import {
  CalendarDays,
  ChevronRight,
  Syringe,
  ScanLine,
  Droplet,
  Stethoscope,
  ClipboardList,
  Sparkles,
  Check,
  HelpCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";
import { localeTag } from "~/lib/utils/date";
import { upcomingAppointments } from "~/lib/appointments/upcoming";

const KIND_ICON: Record<AppointmentKind, React.ComponentType<{ className?: string }>> = {
  clinic: Stethoscope,
  chemo: Syringe,
  scan: ScanLine,
  blood_test: Droplet,
  procedure: ClipboardList,
  other: Sparkles,
};

const KIND_LABEL_EN: Record<AppointmentKind, string> = {
  clinic: "Clinic",
  chemo: "Chemo",
  scan: "Scan",
  blood_test: "Blood test",
  procedure: "Procedure",
  other: "Event",
};

const KIND_LABEL_ZH: Record<AppointmentKind, string> = {
  clinic: "就诊",
  chemo: "化疗",
  scan: "影像",
  blood_test: "抽血",
  procedure: "操作",
  other: "事件",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function ScheduleCard() {
  const locale = useLocale();
  const appointments = useLiveQuery(
    () => db.appointments.orderBy("starts_at").toArray(),
    [],
  );

  const { upcoming, followUps, totalUpcoming, totalFollowUps } = useMemo(() => {
    const list = appointments ?? [];
    const now = new Date();
    const startToday = startOfDay(now).getTime();
    const endTomorrow = startToday + 2 * 24 * 60 * 60 * 1000;

    const upcomingAll = upcomingAppointments(list, {
      from: startToday,
      until: endTomorrow,
    });

    const followUpsAll = deriveFollowUpTasks({ appointments: list, now });

    return {
      upcoming: upcomingAll.slice(0, 3),
      followUps: followUpsAll.slice(0, 3),
      totalUpcoming: upcomingAll.length,
      totalFollowUps: followUpsAll.length,
    };
  }, [appointments]);

  if (!appointments) return null;
  if (upcoming.length === 0 && followUps.length === 0) return null;

  // Surface a "+N more" hint when the visible slice is truncated, so
  // the patient knows the day list isn't already exhaustive without
  // having to navigate to /schedule to find out.
  const hiddenUpcoming = Math.max(0, totalUpcoming - upcoming.length);
  const hiddenFollowUps = Math.max(0, totalFollowUps - followUps.length);
  const allLabel =
    locale === "zh"
      ? totalUpcoming > 3
        ? `全部 (${totalUpcoming})`
        : "全部"
      : totalUpcoming > 3
        ? `All (${totalUpcoming})`
        : "All";

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--tide-2)]" />
            <div className="text-[13px] font-semibold text-ink-900">
              {locale === "zh" ? "今明日程" : "Today & tomorrow"}
            </div>
          </div>
          <Link
            href="/schedule"
            className="text-[12px] text-ink-500 hover:text-ink-900"
          >
            {allLabel}
            <ChevronRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>

        {upcoming.length > 0 && (
          <ul className="space-y-1.5">
            {upcoming.map((a) => (
              <li key={a.id}>
                <UpcomingRow appt={a} locale={locale} />
              </li>
            ))}
            {hiddenUpcoming > 0 && (
              <li>
                <Link
                  href="/schedule"
                  className="block rounded-md px-2.5 py-1 text-[11.5px] text-ink-500 hover:text-ink-900"
                >
                  {locale === "zh"
                    ? `还有 ${hiddenUpcoming} 项 →`
                    : `+${hiddenUpcoming} more →`}
                </Link>
              </li>
            )}
          </ul>
        )}

        {followUps.length > 0 && (
          <div className="border-t border-ink-100 pt-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
              {locale === "zh" ? "等待跟进" : "Follow up on"}
            </div>
            <ul className="space-y-1.5">
              {followUps.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/schedule/${task.derived_from_appointment_id}`}
                    className="flex items-center gap-2.5 rounded-md border border-dashed border-ink-200 px-2.5 py-1.5 hover:border-ink-400 hover:bg-ink-100/30"
                  >
                    <KindBadge kind={task.appointment_kind} />
                    <div className="flex-1 text-[12.5px] text-ink-800">
                      {locale === "zh" && task.title_zh
                        ? task.title_zh
                        : task.title}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
                  </Link>
                </li>
              ))}
              {hiddenFollowUps > 0 && (
                <li>
                  <Link
                    href="/schedule"
                    className="block rounded-md px-2.5 py-1 text-[11.5px] text-ink-500 hover:text-ink-900"
                  >
                    {locale === "zh"
                      ? `还有 ${hiddenFollowUps} 项 →`
                      : `+${hiddenFollowUps} more →`}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingRow({
  appt,
  locale,
}: {
  appt: Appointment;
  locale: "en" | "zh";
}) {
  const when = formatWhen(appt, locale);
  // Slice F: prefer a confirmed attendance name, then tentative, then
  // falling back to the old doctor / first-attendee chip.
  const confirmed = (appt.attendance ?? []).find(
    (a) => a.status === "confirmed",
  );
  const tentative = (appt.attendance ?? []).find(
    (a) => a.status === "tentative",
  );
  const chip = confirmed
    ? { label: confirmed.name, status: "confirmed" as const }
    : tentative
      ? { label: tentative.name, status: "tentative" as const }
      : appt.doctor || (appt.attendees ?? [])[0]
        ? {
            label: (appt.doctor || (appt.attendees ?? [])[0])!,
            status: "pending" as const,
          }
        : null;
  const chipTone =
    chip?.status === "confirmed"
      ? "bg-[var(--ok-soft)] text-[var(--ok)]"
      : chip?.status === "tentative"
        ? "bg-[var(--sand)] text-ink-900"
        : "bg-paper-2 text-[var(--tide-2)]";
  return (
    <Link
      href={`/schedule/${appt.id}`}
      className="flex items-center gap-2.5 rounded-md bg-[var(--tide-soft)]/40 px-2.5 py-1.5 hover:bg-[var(--tide-soft)]"
    >
      <KindBadge kind={appt.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink-900">
            {appt.title}
          </span>
          {chip && (
            <span
              className={
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium " +
                chipTone
              }
            >
              {chip.status === "confirmed" && (
                <Check className="h-2.5 w-2.5" aria-hidden />
              )}
              {chip.status === "tentative" && (
                <HelpCircle className="h-2.5 w-2.5" aria-hidden />
              )}
              {chip.label}
            </span>
          )}
          {hasActivePrep(appt) && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--warn-soft)] px-1.5 py-px text-[10px] font-medium text-[var(--warn)]">
              {activeFast(appt)
                ? locale === "zh"
                  ? "· 禁食中"
                  : "· fasting"
                : locale === "zh"
                  ? "· 准备中"
                  : "· prep now"}
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-ink-500">
          {when}
          {appt.location && ` · ${appt.location}`}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
    </Link>
  );
}

function KindBadge({ kind }: { kind: AppointmentKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <div
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        "bg-paper-2 text-[var(--tide-2)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function formatWhen(appt: Appointment, locale: "en" | "zh"): string {
  const date = new Date(appt.starts_at);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const start = startOfDay(now);
  const tomorrow = new Date(start);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const apptDay = startOfDay(date);
  const kindLabel =
    locale === "zh" ? KIND_LABEL_ZH[appt.kind] : KIND_LABEL_EN[appt.kind];

  let dayLabel: string;
  if (apptDay.getTime() === start.getTime()) {
    dayLabel = locale === "zh" ? "今天" : "Today";
  } else if (apptDay.getTime() === tomorrow.getTime()) {
    dayLabel = locale === "zh" ? "明天" : "Tomorrow";
  } else {
    dayLabel = date.toLocaleDateString(localeTag(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  if (appt.all_day) return `${kindLabel} · ${dayLabel}`;
  const timeLabel = date.toLocaleTimeString(localeTag(locale), {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${kindLabel} · ${dayLabel} · ${timeLabel}`;
}
