// Persistence helpers for change signals. Thin wrappers around Dexie so the
// detector orchestration stays pure and the consumer (UI, background job)
// handles IO.
import { db } from "~/lib/db/dexie";
import type { ChangeSignalRow } from "~/types/clinical";
import { DETECTORS, evaluateDetectors, reconcileSignals } from ".";
import type { ChangeSignal, DetectorContext, SignalStatus } from "./types";

export async function getOpenSignals(): Promise<ChangeSignalRow[]> {
  return db.change_signals.where("status").equals("open").toArray();
}

export async function getAllSignals(): Promise<ChangeSignalRow[]> {
  return db.change_signals.orderBy("detected_at").reverse().toArray();
}

export function deserializeSignal(row: ChangeSignalRow): ChangeSignal {
  return JSON.parse(row.payload_json) as ChangeSignal;
}

/**
 * Run detectors, reconcile against persisted state, write new open rows, and
 * update rows whose underlying drift has recovered. Safe to call repeatedly
 * (idempotent on the same ctx).
 *
 * Returns the number of rows inserted and resolved, for diagnostic logging.
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
    await db.change_signals.add(row);
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
    resolved++;
  }

  return { inserted, resolved };
}

export async function setSignalStatus(
  id: number,
  status: SignalStatus,
  note?: string,
): Promise<void> {
  await db.change_signals.update(id, {
    status,
    resolved_at: new Date().toISOString(),
    note,
  });
}
