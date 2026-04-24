"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/lib/db/dexie";
import { useLocale, useT } from "~/hooks/use-translate";
import { PageHeader } from "~/components/ui/page-header";
import { PresenceStack } from "~/components/shared/presence-stack";
import { Button } from "~/components/ui/button";
import { AppointmentsCalendar } from "~/components/schedule/calendar";
import { CalendarShare } from "~/components/schedule/calendar-share";
import { derivePrepTasks } from "~/lib/appointments/prep-tasks";
import { deriveFollowUpTasks } from "~/lib/appointments/follow-up-tasks";
import { deriveAwaitingPrepTasks } from "~/lib/appointments/prep";
import { Plus, AlertTriangle, ClipboardList } from "lucide-react";
import type { Appointment } from "~/types/appointment";

export default function SchedulePage() {
  const locale = useLocale();
  const t = useT();

  const appointments = useLiveQuery(
    () => db.appointments.orderBy("starts_at").toArray(),
    [],
    [] as Appointment[],
  );
  const links = useLiveQuery(() => db.appointment_links.toArray(), [], []);

  const prep = derivePrepTasks({
    appointments: appointments ?? [],
    links: links ?? [],
  });
  const followUps = deriveFollowUpTasks({
    appointments: appointments ?? [],
  });
  const awaitingPrep = deriveAwaitingPrepTasks({
    appointments: appointments ?? [],
  });

  const upcoming = (appointments ?? []).filter(
    (a) => new Date(a.starts_at).getTime() >= Date.now() - 12 * 3600 * 1000,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        eyebrow={t("schedule.eyebrow")}
        title={t("schedule.title")}
      />

      <PresenceStack surface="/schedule" />

      <div className="flex flex-wrap gap-2">
        <Link href="/schedule/new">
          <Button size="lg">
            <Plus className="h-4 w-4" />
            {t("schedule.addSmart")}
          </Button>
        </Link>
      </div>

      {prep.length > 0 && (
        <section className="rounded-[var(--r-md)] border border-[var(--warn)]/40 bg-[var(--warn)]/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink-900">
            <AlertTriangle className="h-4 w-4 text-[var(--warn)]" />
            {t("schedule.prepDue")}
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {prep.slice(0, 5).map((task) => (
              <li
                key={`prep-${task.derived_from_link_id}`}
                className="flex items-center justify-between"
              >
                <span>
                  {locale === "zh" && task.title_zh ? task.title_zh : task.title}
                </span>
                <span className="mono text-[11px] text-ink-500">
                  {task.due_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {followUps.length > 0 && (
        <section className="rounded-[var(--r-md)] border border-ink-200 bg-paper-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink-900">
            <ClipboardList className="h-4 w-4 text-[var(--tide-2)]" />
            {t("schedule.followUpDue")}
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {followUps.slice(0, 6).map((task) => (
              <li
                key={`followup-${task.derived_from_appointment_id}`}
                className="flex items-center justify-between"
              >
                <Link
                  href={`/schedule/${task.derived_from_appointment_id}`}
                  className="flex-1 truncate text-ink-800 hover:text-ink-900 hover:underline"
                >
                  {locale === "zh" && task.title_zh
                    ? task.title_zh
                    : task.title}
                </Link>
                <span className="mono shrink-0 text-[11px] text-ink-500">
                  {task.due_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {awaitingPrep.length > 0 && (
        <section className="rounded-[var(--r-md)] border border-[var(--sand-2)] bg-[var(--sand)]/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink-900">
            <ClipboardList className="h-4 w-4 text-[var(--tide-2)]" />
            {locale === "zh" ? "等待准备事项信息" : "Awaiting prep info"}
          </div>
          <ul className="space-y-1.5 text-[13px]">
            {awaitingPrep.slice(0, 6).map((task) => (
              <li
                key={`prepinfo-${task.derived_from_appointment_id}`}
                className="flex items-center justify-between"
              >
                <Link
                  href={`/schedule/${task.derived_from_appointment_id}`}
                  className="flex-1 truncate text-ink-800 hover:text-ink-900 hover:underline"
                >
                  {locale === "zh" && task.title_zh
                    ? task.title_zh
                    : task.title}
                </Link>
                <span className="mono shrink-0 text-[11px] text-ink-500">
                  {task.due_date}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AppointmentsCalendar appointments={appointments ?? []} />

      <CalendarShare locale={locale} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-900">
          {t("schedule.upcoming")}
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-500">{t("schedule.noneUpcoming")}</p>
        ) : (
          <ul className="divide-y divide-ink-100/70 rounded-[var(--r-md)] border border-ink-100/70 bg-paper">
            {upcoming.slice(0, 12).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/schedule/${a.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-paper-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink-900">
                      {a.title}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {formatRange(a, locale)}
                      {a.location ? ` · ${a.location}` : ""}
                      {a.doctor ? ` · ${a.doctor}` : ""}
                    </div>
                  </div>
                  <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-400">
                    {t(`schedule.kind.${a.kind}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatRange(a: Appointment, locale: "en" | "zh"): string {
  const start = new Date(a.starts_at);
  if (Number.isNaN(start.getTime())) return a.starts_at;
  const datePart = start.toLocaleString(locale === "zh" ? "zh-CN" : "en-AU", {
    dateStyle: "medium",
  });
  if (a.all_day) return datePart;
  const timePart = start.toLocaleString(locale === "zh" ? "zh-CN" : "en-AU", {
    timeStyle: "short",
  });
  return `${datePart} · ${timePart}`;
}
