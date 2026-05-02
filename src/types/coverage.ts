import type { LocalizedText } from "./localized";

// Local-first record of a coverage prompt the patient dismissed. Read
// by the coverage engine on every feed compose to decide whether to
// re-surface the same gap. Auto-expires when `snoozed_until` <=
// today; a stale dismiss is treated as no dismiss.
export interface CoverageSnoozeRow {
  id?: number;
  // Stable identifier for the field whose card was dismissed
  // (e.g. `digestion`, `weight`, `practice_morning`). Matches
  // `TrackedField.key` in src/config/tracked-fields.
  field_key: string;
  snoozed_at: string;
  snoozed_until: string; // ISO YYYY-MM-DD
}

// Patient's recent logging behaviour. The coverage engine modulates
// outreach against this so the app stays calm when the patient is
// rough or quiet. Classifier lives in
// src/lib/coverage/engagement-state.ts.
export type EngagementState =
  // Logged something today.
  | "active"
  // Logged at least once in the last 7 days but not today.
  | "light"
  // Nothing in 3+ days.
  | "quiet"
  // Red zone alert active OR fatigue/pain/anorexia high in last 2 days.
  | "rough";

// One detected gap. Rendered as a coverage feed card with a deep-link
// CTA into the right wizard step. The feed composer handles dedup
// against `id` and applies the engagement-aware cap.
export interface CoverageGap {
  id: string;
  field_key: string;
  // Lower number = higher rank. Engine emits 50 by default; cycle-
  // mandated gaps (temperature in nadir) push to 40.
  priority: number;
  title: LocalizedText;
  body: LocalizedText;
  // One-line patient-facing rationale, surfaced behind the small
  // "Why?" affordance on coverage cards. Copied from the
  // TrackedField config so the detector stays the only place that
  // computes a card's full payload.
  why: LocalizedText;
  cta_href: string;
  icon: string;
}
