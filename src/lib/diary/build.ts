import { db } from "~/lib/db/dexie";
import type { DailyEntry, LabResult } from "~/types/clinical";
import type { LogEventRow, AgentRunRow } from "~/types/agent";
import type { VoiceMemo } from "~/types/voice-memo";
import { isoDatePart, todayISO } from "~/lib/utils/date";

// One day in the diary timeline. Aggregates everything the patient
// generated or had recorded for that calendar date — voice memos,
// daily-form entry, free-text logs, lab results, and agent runs.
// The diary page walks a list of these in reverse-chrono order to
// render a unified per-day stream.
export interface DiaryDay {
  day: string;
  voice_memos: VoiceMemo[];
  daily_entry?: DailyEntry;
  log_events: LogEventRow[];
  labs: LabResult[];
  agent_runs: AgentRunRow[];
  // Convenience: true when the day has any kind of content. The page
  // hides empty days unless they're explicitly requested.
  has_content: boolean;
}

export interface BuildDiaryDaysOptions {
  /** Inclusive start day (YYYY-MM-DD). Defaults to 30 days ago. */
  from?: string;
  /** Inclusive end day (YYYY-MM-DD). Defaults to today. */
  to?: string;
  /** When true, days with no entries still appear (handy for navigation). */
  includeEmpty?: boolean;
}

// Build a list of DiaryDay rows from `from` back to `to`, newest first.
// Reads each underlying table once and bins by day, so the cost is
// O(rows-in-window), not O(days × tables).
export async function buildDiaryDays(
  opts: BuildDiaryDaysOptions = {},
): Promise<DiaryDay[]> {
  const to = opts.to ?? todayISO();
  const from = opts.from ?? defaultFrom(to, 30);
  const includeEmpty = opts.includeEmpty ?? false;

  const [memos, dailies, logs, labs, runs] = await Promise.all([
    db.voice_memos
      .where("day")
      .between(from, to, true, true)
      .toArray()
      .then((rows) =>
        rows.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)),
      ),
    db.daily_entries
      .where("date")
      .between(from, to, true, true)
      .toArray(),
    db.log_events.toArray().then((rows) =>
      rows.filter((r) => {
        const day = isoDatePart(r.at);
        return day >= from && day <= to;
      }),
    ),
    db.labs.where("date").between(from, to, true, true).toArray(),
    db.agent_runs.toArray().then((rows) =>
      rows.filter((r) => {
        const day = isoDatePart(r.ran_at);
        return day >= from && day <= to;
      }),
    ),
  ]);

  const byDay = new Map<string, DiaryDay>();
  function ensure(day: string): DiaryDay {
    let d = byDay.get(day);
    if (!d) {
      d = {
        day,
        voice_memos: [],
        log_events: [],
        labs: [],
        agent_runs: [],
        has_content: false,
      };
      byDay.set(day, d);
    }
    return d;
  }

  for (const m of memos) {
    const d = ensure(m.day);
    d.voice_memos.push(m);
    d.has_content = true;
  }
  for (const e of dailies) {
    const d = ensure(e.date);
    d.daily_entry = e;
    d.has_content = true;
  }
  for (const l of logs) {
    const d = ensure(isoDatePart(l.at));
    d.log_events.push(l);
    d.has_content = true;
  }
  for (const lab of labs) {
    const d = ensure(lab.date);
    d.labs.push(lab);
    d.has_content = true;
  }
  for (const r of runs) {
    const day = isoDatePart(r.ran_at);
    if (!day) continue;
    const d = ensure(day);
    d.agent_runs.push(r);
    d.has_content = true;
  }

  // Optionally backfill empty days so the diary still shows a stub
  // header (used when the patient is navigating back through quiet
  // weeks and we want them to see "nothing recorded" rather than a
  // jump in time).
  if (includeEmpty) {
    for (let day = to; day >= from; day = prevDay(day)) {
      ensure(day);
    }
  }

  return Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day));
}

function defaultFrom(to: string, days: number): string {
  const d = new Date(to);
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function prevDay(day: string): string {
  const d = new Date(day);
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
