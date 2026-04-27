import type { LifeEvent } from "~/types/clinical";
import type { Appointment } from "~/types/appointment";
import type { TreatmentCycle } from "~/types/treatment";

// Timeline stream — merges the three data sources that feed the
// family-facing chronological view:
//
//   1. LifeEvents (diary pages, memories, cultural events) — the warm spine
//   2. Completed appointments (chemo, scan, clinic, etc.) — the clinical
//      spine rendered as small date-stamped pills, visually subordinate
//   3. TreatmentCycles — cycle start / end anchors
//
// A pure function so it can be tested deterministically and reused
// anywhere (family feed, quarterly export, seasonal digest).
//
// This is NOT a priority-ranked feed — it is strictly chronological.
// The priority feed (dashboard) and timeline view are two projections
// over overlapping data (see docs/LEGACY_MODULE.md §"Framing").

export type TimelineItem =
  | {
      kind: "life_event";
      id: number;
      /** ISO date or datetime; used as sort key. */
      at: string;
      event: LifeEvent;
    }
  | {
      kind: "appointment";
      id: number;
      at: string;
      appointment: Appointment;
    }
  | {
      kind: "cycle_start" | "cycle_end";
      id: number;
      at: string;
      cycle: TreatmentCycle;
    };

export interface BuildStreamInput {
  life_events: LifeEvent[];
  appointments: Appointment[];
  cycles: TreatmentCycle[];
  /**
   * When true, only memory-flagged life events surface. Defaults false
   * (diary entries, cultural events, and planning events all render).
   */
  memories_only?: boolean;
}

/** Appointment kinds that are meaningful as "this happened" anchors. */
const CLINICAL_SPINE_KINDS = new Set([
  "chemo",
  "scan",
  "clinic",
  "blood_test",
  "procedure",
]);

export function buildTimelineStream(
  input: BuildStreamInput,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const e of input.life_events) {
    if (e.id == null) continue;
    if (input.memories_only && e.is_memory !== true) continue;
    items.push({
      kind: "life_event",
      id: e.id,
      at: e.event_date,
      event: e,
    });
  }

  for (const a of input.appointments) {
    if (a.id == null) continue;
    // "attended" is this codebase's name for the past-happened state;
    // the timeline spine only shows appointments that actually occurred.
    if (a.status !== "attended") continue;
    if (!CLINICAL_SPINE_KINDS.has(a.kind)) continue;
    items.push({
      kind: "appointment",
      id: a.id,
      at: a.starts_at,
      appointment: a,
    });
  }

  for (const c of input.cycles) {
    if (c.id == null) continue;
    items.push({
      kind: "cycle_start",
      id: c.id,
      at: c.start_date,
      cycle: c,
    });
    const end = c.actual_end_date ?? c.planned_end_date;
    if (end) {
      items.push({
        kind: "cycle_end",
        id: c.id,
        at: end,
        cycle: c,
      });
    }
  }

  // Reverse chronological — newest first, as read from top of page.
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items;
}

/**
 * Group a timeline stream into month buckets keyed by "YYYY-MM".
 * Bucket order follows the stream itself (already reverse-chronological),
 * so the returned Map iterates newest month → oldest.
 */
export function groupByMonth(
  items: TimelineItem[],
): Map<string, TimelineItem[]> {
  const out = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = item.at.slice(0, 7); // YYYY-MM
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  return out;
}
