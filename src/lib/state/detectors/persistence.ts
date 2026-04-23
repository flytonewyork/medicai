// Persistence helpers for change signals. Thin wrappers around Dexie so the
// detector orchestration stays pure and the consumer (UI, background job)
// handles IO. Writes to signal_events on every lifecycle transition so the
// attribution layer (slice 4) can walk the timeline.
import { db } from "~/lib/db/dexie";
import { latestChangeSignals } from "~/lib/db/queries";
import type { ChangeSignalRow, SignalEventKind } from "~/types/clinical";
import { evaluateDetectors, reconcileSignals } from ".";
import type { ChangeSignal, DetectorContext, SignalStatus } from "./types";
import { logSignalEvent } from "./events";

export async function getOpenSignals(): Promise<ChangeSignalRow[]> {
  return db.change_signals.where("status").equals("open").toArray();
}

export async function getAllSignals(): Promise<ChangeSignalRow[]> {
  return latestChangeSignals();
}

export function deserializeSignal(row: ChangeSignalRow): ChangeSignal {
  return JSON.parse(row.payload_json) as ChangeSignal;
}

/**
 * Run detectors, reconcile against persisted state, write new open rows, and
 * update rows whose underlying drift has recovered. Safe to call repeatedly
 * (idempotent on the same ctx). Emits `emitted` and `resolved_auto` events
 * so the attribution layer can reconstruct the lifecycle.
 */
export async function evaluateAndPersistSignals(
  ctx: DetectorContext,
): Promise<{ inserted: number; resolved: number }> {
  const emitted = evaluateDetectors(ctx);
  const persisted = await db.change_signals.toArray();
  const reconciliation = reconcileSignals(
    emitted,
    persisted.map((p) => ({ fired_for: p.fired_for, status: p.status })),
    ctx,
  );

  const nowISO = ctx.now;
  let inserted = 0;
  for (const sig of reconciliation.to_insert) {
    const row: ChangeSignalRow = {
      detector: sig.detector,
      fired_for: sig.fired_for,
      metric_id: sig.metric_id,
      axis: sig.axis,
      severity: sig.severity,
      shape: sig.shape,
      status: "open",
      payload_json: JSON.stringify(sig),
      detected_at: nowISO,
    };
    const id = (await db.change_signals.add(row)) as number;
    await logSignalEvent({
      signal_id: id,
      kind: "emitted",
      at: nowISO,
    });
    inserted++;
  }

  let resolved = 0;
  for (const firedFor of reconciliation.to_resolve) {
    const row = await db.change_signals
      .where("fired_for")
      .equals(firedFor)
      .first();
    if (!row?.id) continue;
    await db.change_signals.update(row.id, {
      status: "resolved",
      resolved_at: nowISO,
    });
    await logSignalEvent({
      signal_id: row.id,
      kind: "resolved_auto",
      at: nowISO,
    });
    resolved++;
  }

  return { inserted, resolved };
}

/**
 * Map a user-driven status change to the event kind that should be logged.
 * Centralised so UI components never have to decide the event taxonomy.
 */
function statusToEventKind(
  status: SignalStatus,
): SignalEventKind | null {
  switch (status) {
    case "acknowledged":
      return "acknowledged";
    case "dismissed":
      return "dismissed";
    case "resolved":
      return "resolved_manual";
    case "open":
      return "reopened";
    default:
      return null;
  }
}

/**
 * Update a signal's status and write the corresponding lifecycle event.
 * Single source of truth for user-driven lifecycle transitions — components
 * should call this rather than Dexie directly.
 */
export async function setSignalStatus(
  id: number,
  status: SignalStatus,
  note?: string,
): Promise<void> {
  const nowISO = new Date().toISOString();
  await db.change_signals.update(id, {
    status,
    resolved_at:
      status === "resolved" || status === "dismissed" ? nowISO : undefined,
    note,
  });
  const kind = statusToEventKind(status);
  if (kind) {
    await logSignalEvent({
      signal_id: id,
      kind,
      note,
      at: nowISO,
    });
  }
}

/**
 * Log that the user has taken one of the signal's suggested actions. This
 * is the core action-attribution hook — keep the call site simple
 * (`<MarkDoneButton action={a} signalId={id} />`) because every tap here is
 * a data point the attribution layer later relies on.
 */
export async function markActionTaken(input: {
  signal_id: number;
  action_ref_id: string;
  action_kind?: string;
  note?: string;
}): Promise<void> {
  await logSignalEvent({
    signal_id: input.signal_id,
    kind: "action_taken",
    action_ref_id: input.action_ref_id,
    action_kind: input.action_kind,
    note: input.note,
  });
}
