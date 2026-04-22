"use client";

import { useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { useRouter } from "next/navigation";
import { useLocale } from "~/hooks/use-translate";
import type { Appointment, AppointmentKind } from "~/types/appointment";

// Event colours map to the Anchor palette (see globals.css tokens).
// Each kind gets a light soft background + a clear ink/tide/warn
// accent for the left border + matching readable text. Muted on
// purpose — we want legibility, not cheer.
const KIND_STYLES: Record<
  AppointmentKind,
  { bg: string; border: string; text: string }
> = {
  chemo: {
    bg: "color-mix(in oklch, var(--tide-soft), transparent 10%)",
    border: "var(--tide-2)",
    text: "var(--tide-2)",
  },
  clinic: {
    bg: "var(--paper-2)",
    border: "var(--ink-400)",
    text: "var(--ink-700)",
  },
  scan: {
    bg: "var(--sand)",
    border: "var(--sand-2)",
    text: "oklch(32% 0.04 70)",
  },
  blood_test: {
    bg: "var(--warn-soft)",
    border: "var(--warn)",
    text: "var(--warn)",
  },
  procedure: {
    bg: "color-mix(in oklch, var(--ink-900), transparent 92%)",
    border: "var(--ink-900)",
    text: "var(--ink-900)",
  },
  other: {
    bg: "var(--ink-100)",
    border: "var(--ink-300)",
    text: "var(--ink-700)",
  },
};

export function AppointmentsCalendar({
  appointments,
}: {
  appointments: Appointment[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const calRef = useRef<FullCalendar>(null);

  const events = useMemo<EventInput[]>(() => {
    return appointments.map((a) => {
      const s = KIND_STYLES[a.kind] ?? KIND_STYLES.other;
      return {
        id: String(a.id ?? `new-${a.starts_at}`),
        title: a.title,
        start: a.starts_at,
        end: a.ends_at,
        allDay: a.all_day ?? false,
        backgroundColor: s.bg,
        borderColor: s.border,
        textColor: s.text,
        classNames: ["anchor-event", `anchor-event-${a.kind}`],
        extendedProps: {
          kind: a.kind,
          doctor: a.doctor,
          location: a.location,
          status: a.status,
        },
      };
    });
  }, [appointments]);

  function handleClick(arg: EventClickArg) {
    const id = arg.event.id;
    if (!id || id.startsWith("new-")) return;
    router.push(`/schedule/${id}`);
  }

  function handleDateClick(arg: { dateStr: string; allDay: boolean }) {
    const date = arg.dateStr.slice(0, 10);
    router.push(`/schedule/new?date=${date}`);
  }

  return (
    <div className="anchor-calendar overflow-hidden rounded-[var(--r-md)] border border-ink-100/70 bg-paper">
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
        buttonText={
          locale === "zh"
            ? {
                today: "今天",
                month: "月",
                week: "周",
                day: "日",
                list: "列表",
              }
            : {
                today: "Today",
                month: "Month",
                week: "Week",
                day: "Day",
                list: "List",
              }
        }
        locale={locale === "zh" ? "zh-cn" : "en-au"}
        firstDay={1}
        events={events}
        eventClick={handleClick}
        dateClick={handleDateClick}
        height="auto"
        nowIndicator
        eventDisplay="block"
        dayMaxEventRows={3}
        weekends
      />
    </div>
  );
}
