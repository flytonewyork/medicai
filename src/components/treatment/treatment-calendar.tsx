"use client";

import { useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventClickArg,
  EventInput,
  DayCellMountArg,
} from "@fullcalendar/core";
import { addDays, format, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import {
  effectiveCycleLengthDays,
  type Protocol,
  type TreatmentCycle,
} from "~/types/treatment";
import type { Appointment } from "~/types/appointment";
import { currentPhase } from "~/lib/treatment/engine";

// Standard month-style calendar showing every event the cycle generates or
// touches: dose days, lab draws, cycle-linked clinical appointments, plus a
// soft phase tint on each cell so the dose / nadir / recovery rhythm is
// readable without studying the legend. Replaces the hard-to-skim D1..D28
// grid that lived inside the cycle detail page.

const PHASE_TINTS: Record<string, string> = {
  dose_day: "color-mix(in oklch, var(--tide-2), transparent 80%)",
  post_dose: "color-mix(in oklch, var(--tide-soft), transparent 30%)",
  nadir: "color-mix(in oklch, var(--sand), transparent 35%)",
  recovery_early: "color-mix(in oklch, var(--tide-soft), transparent 50%)",
  recovery_late: "color-mix(in oklch, oklch(88% 0.03 150), transparent 35%)",
  pre_dose: "color-mix(in oklch, var(--ink-100), transparent 35%)",
  rest: "transparent",
};

const APPT_KIND_BG: Record<string, { bg: string; border: string; text: string }> =
  {
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

interface Props {
  cycle: TreatmentCycle;
  protocol: Protocol;
}

export function TreatmentCalendar({ cycle, protocol }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const calRef = useRef<FullCalendar>(null);

  const start = parseISO(cycle.start_date);
  const effectiveLen = effectiveCycleLengthDays(cycle, protocol);
  const cycleEnd = addDays(start, effectiveLen - 1);
  const cycleStartStr = cycle.start_date;
  const cycleEndStr = format(cycleEnd, "yyyy-MM-dd");

  // Pull every record this cycle touches in one place. Each query is keyed
  // on the cycle's date window so adjacent cycles don't bleed events across.
  const labs = useLiveQuery(
    () =>
      db.labs
        .where("date")
        .between(cycleStartStr, cycleEndStr, true, true)
        .toArray(),
    [cycleStartStr, cycleEndStr],
  );
  const appointments = useLiveQuery<Appointment[]>(
    () =>
      cycle.id
        ? db.appointments.where("cycle_id").equals(cycle.id).toArray()
        : Promise.resolve([] as Appointment[]),
    [cycle.id],
  );

  const phaseByDateStr = useMemo(() => {
    const out = new Map<string, string>();
    for (let i = 0; i < effectiveLen; i++) {
      const dayN = i + 1;
      const isExtraRest = dayN > protocol.cycle_length_days;
      const isDose = protocol.dose_days.includes(dayN);
      const phase = currentPhase(protocol, dayN);
      const key = isDose
        ? "dose_day"
        : isExtraRest
          ? "rest"
          : phase?.key ?? "rest";
      out.set(format(addDays(start, i), "yyyy-MM-dd"), key);
    }
    return out;
  }, [
    start,
    effectiveLen,
    protocol.dose_days,
    protocol.cycle_length_days,
    protocol,
  ]);

  const events = useMemo<EventInput[]>(() => {
    const out: EventInput[] = [];

    // Dose days come straight off the protocol — one all-day event per
    // scheduled infusion. The chemo agent name surfaces in the title so a
    // glance at the month immediately tells you "Gem + nab on D1, D8, D15".
    for (const day of protocol.dose_days) {
      if (day < 1 || day > effectiveLen) continue;
      const date = addDays(start, day - 1);
      const agentNames = protocol.agents
        .filter((a) => a.dose_days.includes(day))
        .map((a) => a.display[locale])
        .join(" + ");
      out.push({
        id: `dose-${cycle.id}-${day}`,
        title: agentNames || (locale === "zh" ? "用药" : "Dose"),
        start: format(date, "yyyy-MM-dd"),
        allDay: true,
        backgroundColor: "var(--tide-2)",
        borderColor: "var(--tide-2)",
        textColor: "#fff",
        classNames: ["anchor-event", "anchor-event-dose"],
        extendedProps: { kind: "dose" },
      });
    }

    // Lab draws — one chip per row that landed in this window. Click jumps
    // to /labs so the value can be checked in context.
    for (const l of labs ?? []) {
      out.push({
        id: `lab-${l.id}`,
        title: locale === "zh" ? "化验" : "Lab draw",
        start: l.date,
        allDay: true,
        backgroundColor: "var(--ink-900)",
        borderColor: "var(--ink-900)",
        textColor: "var(--paper)",
        classNames: ["anchor-event", "anchor-event-lab"],
        extendedProps: { kind: "lab", labId: l.id },
      });
    }

    // Cycle-linked appointments — clinics, scans, procedures the patient has
    // already booked or that auto-derived from the protocol.
    for (const a of appointments ?? []) {
      const s = APPT_KIND_BG[a.kind] ?? APPT_KIND_BG.other!;
      out.push({
        id: `appt-${a.id}`,
        title: a.title,
        start: a.starts_at,
        end: a.ends_at,
        allDay: a.all_day ?? false,
        backgroundColor: s.bg,
        borderColor: s.border,
        textColor: s.text,
        classNames: ["anchor-event", `anchor-event-${a.kind}`],
        extendedProps: { kind: "appointment", apptId: a.id },
      });
    }

    return out;
  }, [
    cycle.id,
    start,
    effectiveLen,
    protocol.dose_days,
    protocol.agents,
    labs,
    appointments,
    locale,
  ]);

  function handleClick(arg: EventClickArg) {
    const kind = arg.event.extendedProps.kind as string | undefined;
    if (kind === "appointment") {
      const apptId = arg.event.extendedProps.apptId as number | undefined;
      if (apptId) router.push(`/schedule/${apptId}`);
      return;
    }
    if (kind === "lab") {
      router.push("/labs");
      return;
    }
    // Dose chips don't have their own page — let the cycle detail handle it.
  }

  function handleDateClick(arg: { dateStr: string }) {
    const date = arg.dateStr.slice(0, 10);
    // Pre-select the cycle on the new-appointment form so the appointment
    // links back without the user re-picking the cycle.
    const cycleParam = cycle.id ? `&cycle=${cycle.id}` : "";
    router.push(`/schedule/new?date=${date}${cycleParam}`);
  }

  // Tint cells that fall inside the cycle window with their phase colour.
  // FullCalendar renders day cells before our state is ready, so we paint
  // them directly via dayCellDidMount + el.style.
  function paintCell(arg: DayCellMountArg) {
    const ds = format(arg.date, "yyyy-MM-dd");
    const phase = phaseByDateStr.get(ds);
    if (!phase) return;
    const tint = PHASE_TINTS[phase];
    if (tint && tint !== "transparent") {
      arg.el.style.background = tint;
    }
    arg.el.dataset.anchorPhase = phase;
  }

  return (
    <div className="anchor-calendar overflow-hidden rounded-[var(--r-md)] border border-ink-100/70 bg-paper">
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={cycle.start_date}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,listWeek",
        }}
        buttonText={
          locale === "zh"
            ? { today: "今天", month: "月", list: "列表" }
            : { today: "Today", month: "Month", list: "List" }
        }
        locale={locale === "zh" ? "zh-cn" : "en-au"}
        firstDay={1}
        events={events}
        eventClick={handleClick}
        dateClick={handleDateClick}
        dayCellDidMount={paintCell}
        height="auto"
        nowIndicator
        eventDisplay="block"
        dayMaxEventRows={4}
        weekends
      />

      <div className="flex flex-wrap gap-3.5 border-t border-ink-100/70 px-4 py-3 text-[11px] text-ink-500">
        <LegendChip color="var(--tide-2)" label={locale === "zh" ? "用药" : "Dose"} />
        <LegendChip color="var(--ink-900)" label={locale === "zh" ? "化验" : "Lab"} />
        <LegendChip color="var(--ink-700)" label={locale === "zh" ? "门诊" : "Clinic"} />
        <LegendChip
          color="oklch(32% 0.04 70)"
          label={locale === "zh" ? "扫描" : "Scan"}
        />
        <LegendChip
          color="var(--warn)"
          label={locale === "zh" ? "抽血预约" : "Blood test"}
        />
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}
