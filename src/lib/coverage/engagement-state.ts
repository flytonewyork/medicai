import type { DailyEntry, ZoneAlert } from "~/types/clinical";
import type { EngagementState } from "~/types/coverage";

// Calm-engagement classifier. Patient's recent logging behaviour
// scaled to one of four states; the coverage engine uses this to cap
// outreach so the app doesn't nag during a rough patch.
//
// Rules (in priority order — first match wins):
//   1. Any unresolved red zone alert today → rough.
//      Safety owns the channel that day.
//   2. Last 2 days carry severe symptom signal (fatigue ≥ 7 OR
//      anorexia ≥ 7 OR pain_worst ≥ 7 OR explicit fever) → rough.
//   3. Logged something today → active.
//   4. Logged on at least 2 of the last 7 days → light.
//   5. Otherwise → quiet (silence over a couple of days).
//
// "Logged something" = any DailyEntry row exists for that date with
// at least one tracked field populated. We don't try to infer mood
// from row presence alone — an empty row counts as not logged.

export interface EngagementStateInputs {
  todayISO: string;
  recentDailies: readonly DailyEntry[]; // any order; module sorts defensively
  activeAlerts: readonly ZoneAlert[];
}

const ROUGH_LOOKBACK_DAYS = 2;
const LIGHT_MIN_DAYS = 2;
const SEVERE_SYMPTOM_THRESHOLD = 7;

export function classifyEngagement(
  inputs: EngagementStateInputs,
): EngagementState {
  const { todayISO, recentDailies, activeAlerts } = inputs;

  if (
    activeAlerts.some(
      (a) => !a.resolved && a.zone === "red",
    )
  ) {
    return "rough";
  }

  const sortedDesc = [...recentDailies].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  // Look at the most-recent ROUGH_LOOKBACK_DAYS days for severe symptom signals.
  const roughWindow = sortedDesc.filter((d) =>
    daysBetween(d.date, todayISO) <= ROUGH_LOOKBACK_DAYS - 1 &&
    daysBetween(d.date, todayISO) >= 0,
  );
  if (roughWindow.some(isSevereDay)) return "rough";

  if (sortedDesc.some((d) => d.date === todayISO && hasAnySignal(d))) {
    return "active";
  }

  // Last 7 days, excluding today.
  const recentSeven = sortedDesc.filter((d) => {
    const delta = daysBetween(d.date, todayISO);
    return delta > 0 && delta <= 7;
  });
  const loggedDates = new Set(
    recentSeven.filter(hasAnySignal).map((d) => d.date),
  );
  if (loggedDates.size >= LIGHT_MIN_DAYS) return "light";

  return "quiet";
}

// "Has any signal" mirrors the DailyEntry's optional-field design — we
// look across the broad set of inputs that count as a real log. Pure
// metadata fields (entered_by, created_at, ...) don't count.
function hasAnySignal(d: DailyEntry): boolean {
  return (
    typeof d.energy === "number" ||
    typeof d.sleep_quality === "number" ||
    typeof d.appetite === "number" ||
    typeof d.nausea === "number" ||
    typeof d.weight_kg === "number" ||
    typeof d.steps === "number" ||
    typeof d.protein_grams === "number" ||
    typeof d.fluids_ml === "number" ||
    typeof d.walking_minutes === "number" ||
    typeof d.stool_count === "number" ||
    typeof d.stool_bristol === "number" ||
    d.stool_oil === true ||
    d.stool_blood === true ||
    d.stool_urgency === true ||
    d.pert_with_meals_today !== undefined ||
    d.fever === true ||
    d.practice_morning_completed === true ||
    d.practice_evening_completed === true ||
    (typeof d.reflection === "string" && d.reflection.trim().length > 0)
  );
}

function isSevereDay(d: DailyEntry): boolean {
  if (d.fever === true) return true;
  if (
    typeof d.fatigue === "number" &&
    d.fatigue >= SEVERE_SYMPTOM_THRESHOLD
  )
    return true;
  if (
    typeof d.anorexia === "number" &&
    d.anorexia >= SEVERE_SYMPTOM_THRESHOLD
  )
    return true;
  if (
    typeof d.pain_worst === "number" &&
    d.pain_worst >= SEVERE_SYMPTOM_THRESHOLD
  )
    return true;
  return false;
}

// Whole-day delta between two ISO YYYY-MM-DD strings.
function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + "T12:00:00.000Z");
  const b = Date.parse(bISO + "T12:00:00.000Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / (24 * 3600 * 1000));
}

// Daily cap on coverage prompts surfaced today, by engagement state.
// Designed to feel responsive when the patient is engaged, and quiet
// when they're not.
export function coverageCapForState(state: EngagementState): number {
  switch (state) {
    case "active":
      return 3;
    case "light":
      return 2;
    case "quiet":
      return 1;
    case "rough":
      return 0;
  }
}
