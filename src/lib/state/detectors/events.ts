// Signal event log — Dexie IO for the per-signal lifecycle trail.
//
// Every state transition of a ChangeSignalRow plus every action the user
// marks as done writes one row here. The attribution layer consumes this
// log to answer "was this signal's resolution preceded by any of the
// suggested actions?" — the core loop of the app.
import { db, now } from "~/lib/db/dexie";
import type {
  ChangeSignalRow,
  SignalEventKind,
  SignalEventRow,
} from "~/types/clinical";

export interface LogSignalEventInput {
  signal_id: number;
  kind: SignalEventKind;
  action_ref_id?: string;
  action_kind?: string;
  note?: string;
  at?: string;                  // override timestamp (tests)
}

/**
 * Append an event to the signal's timeline. Single-writer: no dedup logic
 * here — callers decide when to log (e.g. logging `acknowledged` twice is
 * allowed, though typically suppressed at the UI layer).
 */
export async function logSignalEvent(
  input: LogSignalEventInput,
): Promise<number> {
  const row: SignalEventRow = {
    signal_id: input.signal_id,
    kind: input.kind,
    action_ref_id: input.action_ref_id,
    action_kind: input.action_kind,
    note: input.note,
    created_at: input.at ?? now(),
  };
  return (await db.signal_events.add(row)) as number;
}

export async function getEventsForSignal(
  signal_id: number,
): Promise<SignalEventRow[]> {
  return db.signal_events
    .where("signal_id")
    .equals(signal_id)
    .sortBy("created_at");
}

export async function getAllSignalEvents(): Promise<SignalEventRow[]> {
  return db.signal_events.orderBy("created_at").toArray();
}

// ─── Loop summary ─────────────────────────────────────────────────────────

export interface SignalLoopSummary {
  range_days: number;
  signals_emitted: number;
  signals_resolved: number;
  signals_open: number;
  actions_taken: number;
  // Median days between emitted → resolved, across signals resolved in range.
  median_resolution_days: number | null;
  // Fraction of resolved signals in range that had at least one
  // `action_taken` event in their lifetime. Not causal — correlational only.
  fraction_with_action: number | null;
}

/**
 * Compute a rollup of signal-loop activity within the trailing `rangeDays`
 * ending at `asOfISO`. Pure function — caller fetches rows from Dexie.
 */
export function computeLoopSummary(
  signals: readonly ChangeSignalRow[],
  events: readonly SignalEventRow[],
  asOfISO: string,
  rangeDays = 30,
): SignalLoopSummary {
  const asOf = Date.parse(asOfISO);
  const from = asOf - rangeDays * 86_400_000;
  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return !Number.isNaN(t) && t >= from && t <= asOf;
  };

  const emitted = signals.filter((s) => inRange(s.detected_at));
  const resolvedInRange = signals.filter(
    (s) => s.status === "resolved" && inRange(s.resolved_at),
  );
  const open = signals.filter((s) => s.status === "open").length;

  const eventsBySignal = new Map<number, SignalEventRow[]>();
  for (const e of events) {
    const arr = eventsBySignal.get(e.signal_id) ?? [];
    arr.push(e);
    eventsBySignal.set(e.signal_id, arr);
  }

  const actions_taken = events.filter(
    (e) => e.kind === "action_taken" && inRange(e.created_at),
  ).length;

  const resolutionDurations: number[] = [];
  let resolvedWithAction = 0;
  for (const sig of resolvedInRange) {
    if (!sig.id || !sig.resolved_at) continue;
    const dur =
      (Date.parse(sig.resolved_at) - Date.parse(sig.detected_at)) /
      86_400_000;
    if (Number.isFinite(dur) && dur >= 0) resolutionDurations.push(dur);
    const sigEvents = eventsBySignal.get(sig.id) ?? [];
    if (sigEvents.some((e) => e.kind === "action_taken")) {
      resolvedWithAction++;
    }
  }

  const median_resolution_days =
    resolutionDurations.length > 0
      ? median(resolutionDurations)
      : null;
  const fraction_with_action =
    resolvedInRange.length > 0
      ? resolvedWithAction / resolvedInRange.length
      : null;

  return {
    range_days: rangeDays,
    signals_emitted: emitted.length,
    signals_resolved: resolvedInRange.length,
    signals_open: open,
    actions_taken,
    median_resolution_days,
    fraction_with_action,
  };
}

function median(nums: readonly number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}
