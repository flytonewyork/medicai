import { db } from "~/lib/db/dexie";
import type { Imaging, LabResult, LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type { Medication } from "~/types/medication";
import type { TreatmentCycle } from "~/types/treatment";
import type { VoiceMemo } from "~/types/voice-memo";
import { isoDatePart, todayISO } from "~/lib/utils/date";

// Slice 10: clinical-pathway aggregator. Joins everything in the
// patient's clinical journey into one chronological stream so the
// /pathway page can paint the picture: the next thing coming up,
// what's recently happened, and the deeper history.
//
// Reads (no writes) across appointments, life_events (medical),
// labs, imaging, treatment_cycles, medications (active or with a
// stopped_on inside the window), and voice_memos with a clinic_visit
// in their parsed_fields. Each row maps to a normalised PathwayItem
// the UI can render uniformly.

export type PathwayCategory =
  | "appointment"
  | "clinic_visit"
  | "lab"
  | "imaging"
  | "treatment_cycle"
  | "medication"
  | "memo_visit";

export interface PathwayItem {
  // Stable composite id so React keys stay stable across reloads.
  key: string;
  // Calendar timestamp the item is anchored to (ISO datetime when
  // available, ISO date when only the day is known).
  at: string;
  category: PathwayCategory;
  title: string;
  // One-line subtitle: location, doctor, modality, status, etc.
  subtitle?: string;
  // Free-form longer text — visit summary, findings, notes.
  body?: string;
  // The Dexie row id when one applies (lets the UI deep-link).
  row_id?: number;
  // Where to link in-app when the patient taps.
  href?: string;
  // For appointments: status (scheduled / attended / cancelled).
  status?: string;
}

export interface PathwayBuckets {
  // Scheduled in the future + anything today not yet attended.
  upcoming: PathwayItem[];
  // Past 14 days, newest first.
  recent: PathwayItem[];
  // Older than 14 days, capped at `earlierLimit` for performance.
  earlier: PathwayItem[];
}

export interface BuildPathwayOptions {
  /** Inclusive end day for the "earlier" window (YYYY-MM-DD). Defaults today. */
  to?: string;
  /** Days back from `to` for the "recent" bucket. Default 14. */
  recentDays?: number;
  /** Hard cap on the "earlier" bucket so old timelines don't blow up render. */
  earlierLimit?: number;
}

const DEFAULT_RECENT_DAYS = 14;
const DEFAULT_EARLIER_LIMIT = 100;

export async function buildPathway(
  opts: BuildPathwayOptions = {},
): Promise<PathwayBuckets> {
  const to = opts.to ?? todayISO();
  const recentDays = opts.recentDays ?? DEFAULT_RECENT_DAYS;
  const earlierLimit = opts.earlierLimit ?? DEFAULT_EARLIER_LIMIT;

  const [appts, lifeEvents, labs, imagingRows, cycles, meds, memos] =
    await Promise.all([
      db.appointments.toArray(),
      db.life_events.where("category").equals("medical").toArray(),
      db.labs.toArray(),
      db.imaging.toArray(),
      db.treatment_cycles.toArray(),
      db.medications.toArray(),
      db.voice_memos.toArray(),
    ]);

  const items: PathwayItem[] = [
    ...appts.map(appointmentToItem),
    ...lifeEvents.map(lifeEventToItem),
    ...labs.map(labToItem),
    ...imagingRows.map(imagingToItem),
    ...cycles.map(cycleToItem),
    ...meds.flatMap(medToItems),
    ...memos.flatMap(memoToItems),
  ];

  const todayDay = isoDatePart(to);
  const recentBoundary = subDaysISO(todayDay, recentDays);

  const upcoming: PathwayItem[] = [];
  const recent: PathwayItem[] = [];
  const earlier: PathwayItem[] = [];

  for (const it of items) {
    const day = isoDatePart(it.at);
    if (day > todayDay) {
      upcoming.push(it);
      continue;
    }
    // Today's items: appointments not yet attended go in upcoming;
    // everything else (already-happened visits / labs / etc.) goes
    // in recent.
    if (day === todayDay) {
      if (
        it.category === "appointment" &&
        it.status !== "attended" &&
        it.status !== "missed" &&
        it.status !== "cancelled"
      ) {
        upcoming.push(it);
      } else {
        recent.push(it);
      }
      continue;
    }
    if (day >= recentBoundary) {
      recent.push(it);
    } else {
      earlier.push(it);
    }
  }

  upcoming.sort((a, b) => a.at.localeCompare(b.at));
  recent.sort((a, b) => b.at.localeCompare(a.at));
  earlier.sort((a, b) => b.at.localeCompare(a.at));

  return {
    upcoming,
    recent,
    earlier: earlier.slice(0, earlierLimit),
  };
}

function subDaysISO(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function appointmentToItem(a: Appointment): PathwayItem {
  const subtitleBits: string[] = [a.kind];
  if (a.doctor) subtitleBits.push(a.doctor);
  if (a.location) subtitleBits.push(a.location);
  return {
    key: `appt-${a.id ?? a.starts_at}`,
    at: a.starts_at,
    category: "appointment",
    title: a.title,
    subtitle: subtitleBits.join(" · "),
    body: a.notes ?? undefined,
    row_id: a.id,
    href: a.id ? `/schedule/${a.id}` : undefined,
    status: a.status,
  };
}

function lifeEventToItem(e: LifeEvent): PathwayItem {
  return {
    key: `life-${e.id ?? e.event_date}`,
    at: e.event_date,
    category: "clinic_visit",
    title: e.title,
    subtitle: e.author ? `by ${e.author}` : undefined,
    body: e.notes ?? undefined,
    row_id: e.id,
    href: "/family/timeline",
  };
}

function labToItem(l: LabResult): PathwayItem {
  // Labs has many typed analyte fields; enumerate the ones with
  // values for the subtitle so the patient sees what's in the row
  // without opening the page.
  const named: string[] = [];
  const tracked: Array<[keyof LabResult, string]> = [
    ["ca199", "CA 19-9"],
    ["cea", "CEA"],
    ["wbc", "WBC"],
    ["hemoglobin", "Hb"],
    ["platelets", "Plt"],
    ["alt", "ALT"],
    ["albumin", "Alb"],
    ["creatinine", "Cr"],
  ];
  for (const [key, label] of tracked) {
    const v = (l as unknown as Record<string, unknown>)[key as string];
    if (typeof v === "number") named.push(`${label} ${v}`);
  }
  const summary = named.length > 0 ? named.slice(0, 3).join(" · ") : "Bloods";
  return {
    key: `lab-${l.id ?? l.date}`,
    at: l.date,
    category: "lab",
    title: summary,
    subtitle: l.source ? `source: ${l.source}` : undefined,
    body: l.notes ?? undefined,
    row_id: l.id,
    href: "/labs",
  };
}

function imagingToItem(i: Imaging): PathwayItem {
  return {
    key: `img-${i.id ?? i.date}`,
    at: i.date,
    category: "imaging",
    title: `${i.modality} — ${i.findings_summary}`,
    subtitle: i.recist_status ? `RECIST: ${i.recist_status}` : undefined,
    body: i.notes ?? undefined,
    row_id: i.id,
    href: "/labs",
  };
}

function cycleToItem(c: TreatmentCycle): PathwayItem {
  return {
    key: `cycle-${c.id ?? c.start_date}`,
    at: c.start_date,
    category: "treatment_cycle",
    title: `Cycle ${c.cycle_number} (${c.protocol_id})`,
    subtitle: `dose level ${c.dose_level} · ${c.status}`,
    body: c.dose_modification_notes ?? undefined,
    row_id: c.id,
    href: c.id ? `/treatment/${c.id}` : "/treatment",
    status: c.status,
  };
}

function medToItems(m: Medication): PathwayItem[] {
  const items: PathwayItem[] = [];
  // "Started" event when the medication has a start date.
  if (m.started_on) {
    items.push({
      key: `med-start-${m.id}`,
      at: m.started_on,
      category: "medication",
      title: `Started ${m.display_name ?? m.drug_id}`,
      subtitle: `${m.dose} · ${m.route}`,
      body: m.notes ?? undefined,
      row_id: m.id,
      href: m.id ? `/medications/${m.id}` : "/medications",
    });
  }
  // "Stopped" event when the medication ended.
  if (m.stopped_on) {
    items.push({
      key: `med-stop-${m.id}`,
      at: m.stopped_on,
      category: "medication",
      title: `Stopped ${m.display_name ?? m.drug_id}`,
      subtitle: `${m.dose} · ${m.route}`,
      body: m.notes ?? undefined,
      row_id: m.id,
      href: m.id ? `/medications/${m.id}` : "/medications",
    });
  }
  return items;
}

function memoToItems(memo: VoiceMemo): PathwayItem[] {
  const visit = memo.parsed_fields?.clinical?.clinic_visit;
  if (!visit?.summary) return [];
  return [
    {
      key: `memo-${memo.id}-visit`,
      at: visit.visit_date ?? memo.recorded_at,
      category: "memo_visit",
      title: visit.provider
        ? `Visit notes — ${visit.provider}`
        : "Visit notes (voice memo)",
      subtitle: visit.kind ? `kind: ${visit.kind}` : undefined,
      body: visit.summary,
      row_id: memo.id,
      href: memo.id ? `/memos/${memo.id}` : undefined,
    },
  ];
}
