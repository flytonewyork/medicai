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

// Colour map keyed by appointment kind. Muted, matches the wider
// paper/ink palette — we're not trying to be cheerful, just legible.
const KIND_COLORS: Record<AppointmentKind, { bg: string; border: string; text: string }> = {
  chemo:      { bg: "#1f2937", border: "#0f172a", text: "#f5f1e8" },
  clinic:     { bg: "#64748b", border: "#334155", text: "#ffffff" },
  scan:       { bg: "#b45309", border: "#92400e", text: "#ffffff" },
  blood_test: { bg: "#991b1b", border: "#7f1d1d", text: "#ffffff" },
  procedure:  { bg: "#4338ca", border: "#312e81", text: "#ffffff" },
  other:      { bg: "#6b7280", border: "#4b5563", text: "#ffffff" },
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
      const colors = KIND_COLORS[a.kind] ?? KIND_COLORS.other;
      return {
        id: String(a.id ?? `new-${a.starts_at}`),
        title: prefix(a.kind) + a.title,
        start: a.starts_at,
        end: a.ends_at,
        allDay: a.all_day ?? false,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
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
    <div className="overflow-hidden rounded-[var(--r-md)] border border-ink-100/70 bg-paper">
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
            : undefined
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

function prefix(kind: AppointmentKind): string {
  switch (kind) {
    case "chemo":      return "◉ ";
    case "clinic":     return "☰ ";
    case "scan":       return "◎ ";
    case "blood_test": return "∽ ";
    case "procedure":  return "⊕ ";
    case "other":      return "· ";
  }
}
