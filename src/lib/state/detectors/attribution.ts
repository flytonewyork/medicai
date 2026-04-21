// Outcome attribution — given a resolved signal and its event log, produce
// a structured summary of what actions were logged during the signal's open
// window and rank them by plausibility of contribution.
//
// This is correlational, not causal. The UI must label it as such. Over many
// signals the correlation pattern may become informative (e.g. "steps
// decline signals consistently resolved within 7 days of a logged walk
// action" is a real useful insight; "consistently resolved without any
// logged action" tells us the signal is noisy).
import type {
  ChangeSignalRow,
  SignalEventRow,
} from "~/types/clinical";

export type AttributionConfidence = "likely" | "possible" | "unknown";

export interface AttributedAction {
  action_ref_id: string;
  action_kind?: string;
  taken_at: string;
  days_before_resolution?: number;
  confidence: AttributionConfidence;
}

export interface SignalAttribution {
  signal_id: number;
  detected_at: string;
  resolved_at?: string;
  duration_days?: number;
  status: ChangeSignalRow["status"];
  // All action_taken events logged during the signal's lifetime, in
  // chronological order.
  actions_taken: AttributedAction[];
  // Shortcut: any action_taken within LIKELY_WINDOW days before resolution.
  likely_contributors: AttributedAction[];
  // True when signal resolved and no actions were logged — either the drift
  // was noise, spontaneous recovery, or the intervention happened off-app.
  spontaneous: boolean;
}

// If an action was logged within LIKELY_WINDOW days before resolution,
// we classify it as a likely contributor. Within POSSIBLE_WINDOW but
// outside LIKELY_WINDOW it's still a possible contributor. Beyond that it
// was early in the signal's life and likely didn't drive resolution.
const LIKELY_WINDOW_DAYS = 5;
const POSSIBLE_WINDOW_DAYS = 14;

export function attributeSignal(
  signal: ChangeSignalRow,
  events: readonly SignalEventRow[],
): SignalAttribution {
  const detected = Date.parse(signal.detected_at);
  const resolved = signal.resolved_at
    ? Date.parse(signal.resolved_at)
    : null;
  const duration_days =
    resolved != null && !Number.isNaN(resolved)
      ? Math.round(((resolved - detected) / 86_400_000) * 10) / 10
      : undefined;

  const actionEvents = events.filter(
    (e) => e.kind === "action_taken" && e.action_ref_id,
  );

  const actions_taken: AttributedAction[] = actionEvents
    .map((e) => {
      const taken = Date.parse(e.created_at);
      let daysBefore: number | undefined;
      let confidence: AttributionConfidence = "unknown";
      if (resolved != null && !Number.isNaN(resolved)) {
        const diff = (resolved - taken) / 86_400_000;
        daysBefore = Math.round(diff * 10) / 10;
        if (diff < 0) {
          // action logged after resolution — ignore for contribution
          confidence = "unknown";
        } else if (diff <= LIKELY_WINDOW_DAYS) {
          confidence = "likely";
        } else if (diff <= POSSIBLE_WINDOW_DAYS) {
          confidence = "possible";
        } else {
          confidence = "unknown";
        }
      } else {
        // signal still open — any action is "possible" contribution.
        confidence = "possible";
      }
      return {
        action_ref_id: e.action_ref_id!,
        action_kind: e.action_kind,
        taken_at: e.created_at,
        days_before_resolution: daysBefore,
        confidence,
      };
    })
    .sort((a, b) => Date.parse(a.taken_at) - Date.parse(b.taken_at));

  const likely_contributors = actions_taken.filter(
    (a) => a.confidence === "likely",
  );
  const spontaneous =
    signal.status === "resolved" && actions_taken.length === 0;

  return {
    signal_id: signal.id ?? 0,
    detected_at: signal.detected_at,
    resolved_at: signal.resolved_at,
    duration_days,
    status: signal.status,
    actions_taken,
    likely_contributors,
    spontaneous,
  };
}

/**
 * Index events by signal id for bulk attribution over many signals.
 */
export function eventsBySignalId(
  events: readonly SignalEventRow[],
): Map<number, SignalEventRow[]> {
  const out = new Map<number, SignalEventRow[]>();
  for (const e of events) {
    const arr = out.get(e.signal_id) ?? [];
    arr.push(e);
    out.set(e.signal_id, arr);
  }
  return out;
}
