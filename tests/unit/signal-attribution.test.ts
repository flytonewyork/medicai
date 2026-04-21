import { describe, it, expect } from "vitest";
import {
  attributeSignal,
  eventsBySignalId,
  computeLoopSummary,
} from "~/lib/state/detectors";
import type {
  ChangeSignalRow,
  SignalEventRow,
} from "~/types/clinical";

function signal(
  over: Partial<ChangeSignalRow> = {},
): ChangeSignalRow {
  return {
    id: 1,
    detector: "steps_decline",
    fired_for: "steps_decline:2026-W15",
    metric_id: "steps",
    axis: "individual",
    severity: "caution",
    shape: "rolling_drift",
    status: "open",
    payload_json: "{}",
    detected_at: "2026-04-01T08:00:00Z",
    ...over,
  };
}

function event(over: Partial<SignalEventRow> = {}): SignalEventRow {
  return {
    signal_id: 1,
    kind: "emitted",
    created_at: "2026-04-01T08:00:00Z",
    ...over,
  };
}

describe("attributeSignal", () => {
  it("lists no actions when events contain only lifecycle transitions", () => {
    const sig = signal({ status: "resolved", resolved_at: "2026-04-08T08:00:00Z" });
    const events = [
      event({ kind: "emitted" }),
      event({ kind: "resolved_auto", created_at: "2026-04-08T08:00:00Z" }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken).toEqual([]);
    expect(attr.spontaneous).toBe(true);
    expect(attr.duration_days).toBeCloseTo(7, 0);
  });

  it("marks an action as 'likely' when taken within 5 days before resolution", () => {
    const sig = signal({ status: "resolved", resolved_at: "2026-04-08T08:00:00Z" });
    const events = [
      event({ kind: "emitted" }),
      event({
        kind: "action_taken",
        action_ref_id: "gentle_walk_10min",
        action_kind: "self",
        created_at: "2026-04-05T10:00:00Z",
      }),
      event({ kind: "resolved_auto", created_at: "2026-04-08T08:00:00Z" }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken).toHaveLength(1);
    expect(attr.actions_taken[0].confidence).toBe("likely");
    expect(attr.likely_contributors).toHaveLength(1);
    expect(attr.spontaneous).toBe(false);
  });

  it("classifies actions 5-14 days before resolution as 'possible'", () => {
    const sig = signal({ status: "resolved", resolved_at: "2026-04-20T08:00:00Z" });
    const events = [
      event({ kind: "emitted", created_at: "2026-04-01T08:00:00Z" }),
      event({
        kind: "action_taken",
        action_ref_id: "nutrition.dietitian",
        created_at: "2026-04-10T09:00:00Z", // 10 days before resolution
      }),
      event({ kind: "resolved_auto", created_at: "2026-04-20T08:00:00Z" }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken[0].confidence).toBe("possible");
    expect(attr.likely_contributors).toHaveLength(0);
  });

  it("classifies actions >14 days before resolution as 'unknown'", () => {
    const sig = signal({ status: "resolved", resolved_at: "2026-05-01T08:00:00Z" });
    const events = [
      event({ kind: "emitted", created_at: "2026-04-01T08:00:00Z" }),
      event({
        kind: "action_taken",
        action_ref_id: "physical.resistance",
        created_at: "2026-04-10T09:00:00Z", // 21 days before resolution
      }),
      event({ kind: "resolved_auto", created_at: "2026-05-01T08:00:00Z" }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken[0].confidence).toBe("unknown");
  });

  it("treats all actions on an open signal as 'possible'", () => {
    const sig = signal({ status: "open" });
    const events = [
      event({ kind: "emitted" }),
      event({
        kind: "action_taken",
        action_ref_id: "gentle_walk_10min",
        created_at: "2026-04-05T10:00:00Z",
      }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken[0].confidence).toBe("possible");
    expect(attr.spontaneous).toBe(false);
    expect(attr.duration_days).toBeUndefined();
  });

  it("sorts actions chronologically", () => {
    const sig = signal({ status: "resolved", resolved_at: "2026-04-20T08:00:00Z" });
    const events = [
      event({
        kind: "action_taken",
        action_ref_id: "second",
        created_at: "2026-04-16T08:00:00Z",
      }),
      event({
        kind: "action_taken",
        action_ref_id: "first",
        created_at: "2026-04-10T08:00:00Z",
      }),
      event({ kind: "emitted", created_at: "2026-04-01T08:00:00Z" }),
    ];
    const attr = attributeSignal(sig, events);
    expect(attr.actions_taken.map((a) => a.action_ref_id)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("eventsBySignalId", () => {
  it("groups events by their signal_id", () => {
    const events = [
      event({ signal_id: 1, kind: "emitted" }),
      event({ signal_id: 2, kind: "emitted" }),
      event({ signal_id: 1, kind: "acknowledged" }),
    ];
    const grouped = eventsBySignalId(events);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });
});

describe("computeLoopSummary", () => {
  const asOf = "2026-04-30T12:00:00Z";

  it("counts signals emitted and resolved within the range", () => {
    const signals = [
      signal({ id: 1, detected_at: "2026-04-10T00:00:00Z" }),
      signal({
        id: 2,
        detected_at: "2026-04-15T00:00:00Z",
        status: "resolved",
        resolved_at: "2026-04-22T00:00:00Z",
      }),
      // Out of range — ignored
      signal({ id: 3, detected_at: "2025-12-01T00:00:00Z" }),
    ];
    const events: SignalEventRow[] = [];
    const s = computeLoopSummary(signals, events, asOf, 30);
    expect(s.signals_emitted).toBe(2);
    expect(s.signals_resolved).toBe(1);
  });

  it("computes median resolution duration + fraction with action", () => {
    const signals = [
      signal({
        id: 1,
        detected_at: "2026-04-01T00:00:00Z",
        status: "resolved",
        resolved_at: "2026-04-08T00:00:00Z",
      }),
      signal({
        id: 2,
        detected_at: "2026-04-10T00:00:00Z",
        status: "resolved",
        resolved_at: "2026-04-18T00:00:00Z",
      }),
      signal({
        id: 3,
        detected_at: "2026-04-15T00:00:00Z",
        status: "resolved",
        resolved_at: "2026-04-25T00:00:00Z",
      }),
    ];
    const events: SignalEventRow[] = [
      event({
        signal_id: 1,
        kind: "action_taken",
        action_ref_id: "x",
        created_at: "2026-04-05T00:00:00Z",
      }),
      event({
        signal_id: 3,
        kind: "action_taken",
        action_ref_id: "y",
        created_at: "2026-04-20T00:00:00Z",
      }),
    ];
    const s = computeLoopSummary(signals, events, asOf, 30);
    expect(s.signals_resolved).toBe(3);
    // Durations: 7, 8, 10 → median 8
    expect(s.median_resolution_days).toBe(8);
    // 2 of 3 had an action
    expect(s.fraction_with_action).toBeCloseTo(2 / 3, 3);
    expect(s.actions_taken).toBe(2);
  });

  it("returns null resolution-stats when nothing resolved in range", () => {
    const signals = [signal({ id: 1, detected_at: "2026-04-10T00:00:00Z" })];
    const s = computeLoopSummary(signals, [], asOf, 30);
    expect(s.median_resolution_days).toBeNull();
    expect(s.fraction_with_action).toBeNull();
  });
});
