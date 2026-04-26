"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { addDays, format, parseISO } from "date-fns";
import { db } from "~/lib/db/dexie";
import { useLocale } from "~/hooks/use-translate";
import {
  cycleDayDate,
  getDayRecord,
  upsertDayRecord,
} from "~/lib/treatment/day-records";
import { currentPhase } from "~/lib/treatment/engine";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { TextInput, Textarea } from "~/components/ui/field";
import {
  CalendarPlus,
  Check,
  ChevronRight,
  FlaskConical,
  Pill,
  Stethoscope,
  Syringe,
  ScanLine,
  X,
} from "lucide-react";
import type { Appointment } from "~/types/appointment";
import type { Protocol, TreatmentCycle } from "~/types/treatment";

// Bottom-anchored detail panel for a selected cycle day. Shows dose /
// phase / what-to-expect, any appointments the calendar already knows
// about for that date, any lab rows, and the per-day administered +
// dose-modification record. Writes back into `cycle.day_records` via
// upsertDayRecord so the cycle page's main calendar shows the same state.

const APPT_ICON: Partial<Record<Appointment["kind"], React.ComponentType<{ className?: string }>>> =
  {
    chemo: Syringe,
    clinic: Stethoscope,
    scan: ScanLine,
    blood_test: FlaskConical,
  };

export function CycleDayDetail({
  cycle,
  protocol,
  dayNumber,
  onClose,
}: {
  cycle: TreatmentCycle;
  protocol: Protocol;
  dayNumber: number;
  onClose: () => void;
}) {
  const locale = useLocale();
  const L = (en: string, zh: string) => (locale === "zh" ? zh : en);

  const date = cycleDayDate(cycle.start_date, dayNumber);
  const fullDate = useMemo(
    () => format(addDays(parseISO(cycle.start_date), dayNumber - 1), "EEEE d MMM"),
    [cycle.start_date, dayNumber],
  );
  const phase = currentPhase(protocol, dayNumber);
  const isDoseDay = protocol.dose_days.includes(dayNumber);
  const agentsOnDay = protocol.agents.filter((a) =>
    a.dose_days.includes(dayNumber),
  );
  const record = getDayRecord(cycle, dayNumber);

  // Appointments on this date — match either by `cycle_id` join OR by
  // date coincidence so manually-added visits show up even if the user
  // didn't tag them to the cycle.
  const dayAppts = useLiveQuery(async () => {
    const rows = await db.appointments.toArray();
    return rows.filter((a) => {
      if (a.status === "cancelled") return false;
      if (a.cycle_id === cycle.id) {
        return a.starts_at.slice(0, 10) === date;
      }
      return a.starts_at.slice(0, 10) === date;
    });
  }, [cycle.id, date]);

  const dayLabs = useLiveQuery(
    () => db.labs.where("date").equals(date).toArray(),
    [date],
  );

  const [modifying, setModifying] = useState(false);
  const [doseText, setDoseText] = useState(record?.dose_modification ?? "");
  const [notes, setNotes] = useState(record?.notes ?? "");

  async function toggleAdministered() {
    if (!cycle.id) return;
    await upsertDayRecord(cycle.id, dayNumber, {
      administered: !record?.administered,
    });
  }

  async function saveModification() {
    if (!cycle.id) return;
    await upsertDayRecord(cycle.id, dayNumber, {
      dose_modification: doseText.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setModifying(false);
  }

  return (
    <Card className="border-[var(--tide-2)]/40">
      <CardContent className="space-y-4 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">
              {L(`Day ${dayNumber}`, `第 ${dayNumber} 天`)} · {fullDate}
            </div>
            <div className="serif mt-0.5 text-[18px] text-ink-900">
              {isDoseDay
                ? L("Dose day", "用药日")
                : phase?.label[locale] ?? L("Rest", "休息")}
            </div>
            {phase?.description[locale] && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
                {phase.description[locale]}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={L("Close", "关闭")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isDoseDay && agentsOnDay.length > 0 && (
          <section className="space-y-2">
            <div className="eyebrow">{L("Dosing", "用药")}</div>
            <ul className="space-y-1.5">
              {agentsOnDay.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-[var(--r-md)] bg-paper-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink-900">
                      {a.display[locale]}
                    </div>
                    <div className="text-[11px] text-ink-500">
                      {a.typical_dose}
                      {a.infusion_time_min
                        ? ` · ~${a.infusion_time_min} min`
                        : ""}
                    </div>
                  </div>
                  <Pill className="h-4 w-4 text-ink-400" />
                </li>
              ))}
            </ul>
            {record?.dose_modification && (
              <div className="rounded-md border border-[var(--sand-2)]/40 bg-[var(--sand)]/30 p-2 text-[11.5px] text-ink-700">
                <span className="mono mr-2 text-[9.5px] uppercase tracking-[0.1em] text-ink-400">
                  {L("Modified", "剂量调整")}
                </span>
                {record.dose_modification}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={record?.administered ? "secondary" : "primary"}
                onClick={() => void toggleAdministered()}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {record?.administered
                  ? L("Administered", "已给药")
                  : L("Mark administered", "标记已给药")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModifying((v) => !v)}
              >
                {modifying
                  ? L("Cancel", "取消")
                  : L("Modify dose / note", "调整剂量 / 备注")}
              </Button>
            </div>
            {modifying && (
              <div className="space-y-2 rounded-[var(--r-md)] border border-ink-100 bg-paper-2 p-3">
                <label className="block space-y-1">
                  <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-400">
                    {L("Dose change", "剂量改动")}
                  </span>
                  <TextInput
                    value={doseText}
                    onChange={(e) => setDoseText(e.target.value)}
                    placeholder={L(
                      "e.g. 80% dose (ANC 0.9)",
                      "例如：80% 剂量（ANC 0.9）",
                    )}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-400">
                    {L("Notes", "备注")}
                  </span>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button size="sm" onClick={() => void saveModification()}>
                  <Check className="h-3.5 w-3.5" />
                  {L("Save", "保存")}
                </Button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="eyebrow">
              {L("Scheduled on this day", "这一天的预约")}
            </div>
            <Link
              href={`/schedule/new?date=${date}&cycle=${cycle.id ?? ""}`}
              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 hover:border-[var(--tide-2)] hover:text-[var(--tide-2)]"
            >
              <CalendarPlus className="h-3 w-3" />
              {L("Add appointment", "新增预约")}
            </Link>
          </div>
          {dayAppts && dayAppts.length > 0 ? (
            <ul className="space-y-1.5">
              {dayAppts.map((a) => {
                const Icon = APPT_ICON[a.kind] ?? Stethoscope;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/schedule/${a.id}`}
                      className="flex items-center gap-2 rounded-[var(--r-md)] border border-ink-100 bg-paper-2 px-3 py-2 transition-colors hover:border-ink-300"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ink-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-ink-900">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {a.all_day
                            ? L("All day", "全天")
                            : format(parseISO(a.starts_at), "HH:mm")}
                          {a.location ? ` · ${a.location}` : ""}
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-ink-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-[var(--r-md)] border border-dashed border-ink-200 bg-paper p-3 text-[12px] text-ink-500">
              {L(
                "Nothing on the schedule for this day yet.",
                "这一天的日程暂无安排。",
              )}
            </div>
          )}
        </section>

        {dayLabs && dayLabs.length > 0 && (
          <section className="space-y-2">
            <div className="eyebrow">{L("Labs on this day", "当日化验")}</div>
            <ul className="space-y-1">
              {dayLabs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-[var(--r-md)] bg-paper-2 px-3 py-2 text-[12px] text-ink-700"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-ink-500" />
                  <span className="font-medium">{l.date}</span>
                  <span className="text-ink-500">
                    {[
                      l.neutrophils != null ? `ANC ${l.neutrophils}` : null,
                      l.platelets != null ? `Plt ${l.platelets}` : null,
                      l.hemoglobin != null ? `Hb ${l.hemoglobin}` : null,
                      l.ca199 != null ? `CA19-9 ${l.ca199}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
