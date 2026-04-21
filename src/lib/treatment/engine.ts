import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  CycleContext,
  PhaseWindow,
  Protocol,
  TreatmentCycle,
} from "~/types/treatment";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import { selectNudges, sortBySeverity } from "~/config/treatment-nudges";
import { db } from "~/lib/db/dexie";

export function cycleDayFor(
  startISO: string,
  today: Date = new Date(),
): number {
  const start = parseISO(startISO);
  return differenceInCalendarDays(today, start) + 1;
}

export function currentPhase(
  protocol: Protocol,
  day: number,
): PhaseWindow | null {
  // Prefer the most specific (shortest-range) match.
  const matches = protocol.phase_windows.filter(
    (w) => day >= w.day_start && day <= w.day_end,
  );
  if (matches.length === 0) return null;
  return matches.reduce((best, w) => {
    const bestLen = best.day_end - best.day_start;
    const wLen = w.day_end - w.day_start;
    return wLen < bestLen ? w : best;
  });
}

export function daysUntilNextDose(
  protocol: Protocol,
  day: number,
): number | null {
  const next = protocol.dose_days.find((d) => d > day);
  if (next === undefined) return null;
  return next - day;
}

export function daysUntilNadir(
  protocol: Protocol,
  day: number,
): number | null {
  const nadir = protocol.phase_windows.find((w) => w.key === "nadir");
  if (!nadir) return null;
  if (day >= nadir.day_start && day <= nadir.day_end) return 0;
  if (day < nadir.day_start) return nadir.day_start - day;
  return null;
}

export function resolveActiveProtocol(
  cycle: TreatmentCycle,
): Protocol | undefined {
  if (cycle.protocol_id === "custom" && cycle.custom_protocol) {
    return cycle.custom_protocol;
  }
  return PROTOCOL_BY_ID[cycle.protocol_id];
}

export function buildCycleContext(
  cycle: TreatmentCycle,
  today: Date = new Date(),
  symptomFlags: string[] = [],
): CycleContext | null {
  const protocol = resolveActiveProtocol(cycle);
  if (!protocol) return null;
  const day = cycleDayFor(cycle.start_date, today);
  const phase = currentPhase(protocol, day);
  const nudges = sortBySeverity(
    selectNudges({
      protocolId: cycle.protocol_id,
      cycleDay: day,
      symptomFlags,
      snoozedIds: cycle.snoozed_nudge_ids,
      dismissedIds: cycle.dismissed_nudge_ids,
    }),
  );
  return {
    cycle,
    protocol,
    cycle_day: day,
    phase,
    is_dose_day: protocol.dose_days.includes(day),
    days_until_next_dose: daysUntilNextDose(protocol, day),
    days_until_nadir: daysUntilNadir(protocol, day),
    applicable_nudges: nudges,
  };
}

export async function getActiveCycle(): Promise<TreatmentCycle | undefined> {
  const rows = await db.treatment_cycles.toArray();
  const today = new Date();
  return rows
    .filter(
      (c) =>
        c.status === "active" ||
        (c.status === "planned" &&
          differenceInCalendarDays(today, parseISO(c.start_date)) >= 0),
    )
    .sort(
      (a, b) =>
        parseISO(b.start_date).valueOf() - parseISO(a.start_date).valueOf(),
    )[0];
}

export async function getActiveCycleContext(
  today: Date = new Date(),
): Promise<CycleContext | null> {
  const cycle = await getActiveCycle();
  if (!cycle) return null;
  const latestDaily = await db.daily_entries
    .orderBy("date")
    .reverse()
    .limit(1)
    .first();
  const flags: string[] = [];
  if (latestDaily?.fever) flags.push("fever");
  if ((latestDaily?.nausea ?? 0) >= 5) flags.push("nausea");
  if ((latestDaily?.diarrhoea_count ?? 0) >= 3) flags.push("diarrhoea");
  if (latestDaily?.neuropathy_feet || latestDaily?.neuropathy_hands) {
    flags.push("neuropathy");
  }
  if ((latestDaily?.appetite ?? 10) <= 3) flags.push("low_appetite");
  return buildCycleContext(cycle, today, flags);
}
