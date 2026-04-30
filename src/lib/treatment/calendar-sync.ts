// Treatment cycle → calendar appointment sync.
//
// Chemo cycles have dose days defined in their protocol (e.g. GnP is
// D1/D8/D15 of a 28-day cycle). Historically those days lived only on the
// cycle record; the schedule / dashboard had no idea a chemo day was
// coming up unless the user manually created an appointment for it. This
// module fills that gap.
//
// `deriveCycleAppointments` is pure — it takes a TreatmentCycle + Protocol
// and returns the Appointment rows that should exist on the calendar.
// `syncCycleToCalendar` does the Dexie writes idempotently: each dose day
// gets a deterministic `ics_uid` (`cycle-<id>-day-<d>`) and only missing
// rows are inserted. Existing rows (created manually or previously synced)
// are left alone so user edits aren't clobbered.

import { db, now } from "~/lib/db/dexie";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { formatLocalDateISO, formatHHMM } from "~/lib/utils/date";
import type { Appointment } from "~/types/appointment";
import type { Protocol, TreatmentCycle } from "~/types/treatment";
import type { LocalizedText } from "~/types/treatment";

export interface DerivedAppointment
  extends Pick<
    Appointment,
    | "kind"
    | "title"
    | "starts_at"
    | "ends_at"
    | "status"
    | "derived_from_cycle"
    | "cycle_id"
    | "ics_uid"
    | "notes"
  > {
  kind: "chemo";
}

// Deterministic ids. One per (cycle, dose day) — any change to cycle
// start date just rewrites the same slot instead of accumulating ghosts.
export function cycleDayIcsUid(cycleId: number, day: number): string {
  return `anchor-cycle-${cycleId}-day-${day}`;
}

function addDaysISO(isoDate: string, days: number, startTime = "09:00"): string {
  // `isoDate` is an ISO date like "2026-05-13" (or "2026-05-13T…"); we
  // want start_date + (days) at `startTime` local — we just write an
  // offset-free ISO so downstream consumers render in the user's tz.
  const dayStr = isoDate.slice(0, 10);
  const [y, m, d] = dayStr.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  const iso = base.toISOString().slice(0, 10);
  return `${iso}T${startTime}:00`;
}

function localizedEn(text: LocalizedText | string | undefined): string {
  if (!text) return "";
  return typeof text === "string" ? text : (text.en ?? "");
}

export function deriveCycleAppointments(
  cycle: TreatmentCycle,
  protocol: Protocol,
  defaultStartTime = "09:00",
  defaultDurationMinutes = 240,
): DerivedAppointment[] {
  if (!cycle.id) return [];
  if (cycle.status === "cancelled") return [];
  const seen = new Set<number>();
  const doseDays = [
    ...(protocol.dose_days ?? []),
    ...protocol.agents.flatMap((a) => a.dose_days ?? []),
  ]
    .filter((d) => {
      if (!Number.isFinite(d) || d < 1) return false;
      if (seen.has(d)) return false;
      seen.add(d);
      return true;
    })
    .sort((a, b) => a - b);

  const out: DerivedAppointment[] = [];
  for (const day of doseDays) {
    const startsAt = addDaysISO(cycle.start_date, day - 1, defaultStartTime);
    const endsAt = (() => {
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) return undefined;
      const end = new Date(start.getTime() + defaultDurationMinutes * 60_000);
      // Match the offset-free "YYYY-MM-DDTHH:MM:SS" shape of starts_at
      // so the two align visually in the schedule form.
      return `${formatLocalDateISO(end)}T${formatHHMM(end)}:00`;
    })();
    const record = cycle.day_records?.find((r) => r.day === day);
    out.push({
      kind: "chemo",
      title: `${protocol.short_name} · Cycle ${cycle.cycle_number} · Day ${day}`,
      starts_at: startsAt,
      ends_at: endsAt,
      status: record?.administered ? "attended" : "scheduled",
      derived_from_cycle: true,
      cycle_id: cycle.id,
      ics_uid: cycleDayIcsUid(cycle.id, day),
      notes: [
        localizedEn(protocol.name),
        protocol.agents
          .map((a) => `${a.name}${a.typical_dose ? ` (${a.typical_dose})` : ""}`)
          .join(" + "),
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }
  return out;
}

export interface SyncResult {
  added: number;
  skipped: number;
}

export async function syncCycleToCalendar(
  cycle: TreatmentCycle,
): Promise<SyncResult> {
  if (!cycle.id) return { added: 0, skipped: 0 };
  const protocol =
    cycle.protocol_id === "custom" && cycle.custom_protocol
      ? cycle.custom_protocol
      : PROTOCOL_BY_ID[cycle.protocol_id];
  if (!protocol) return { added: 0, skipped: 0 };

  const derived = deriveCycleAppointments(cycle, protocol);
  if (derived.length === 0) return { added: 0, skipped: 0 };

  const uids = derived.map((d) => d.ics_uid!).filter(Boolean);
  const existing = await db.appointments
    .where("ics_uid")
    .anyOf(uids)
    .toArray()
    .catch(async () => {
      // Fallback if `ics_uid` isn't indexed in this Dexie version.
      const all = await db.appointments.toArray();
      return all.filter((a) => a.ics_uid && uids.includes(a.ics_uid));
    });
  const existingUids = new Set(
    existing.map((a) => a.ics_uid).filter((v): v is string => !!v),
  );

  let added = 0;
  let skipped = 0;
  for (const row of derived) {
    if (row.ics_uid && existingUids.has(row.ics_uid)) {
      skipped += 1;
      continue;
    }
    const ts = now();
    await db.appointments.add({
      ...row,
      created_at: ts,
      updated_at: ts,
    } as Appointment);
    added += 1;
  }
  return { added, skipped };
}
