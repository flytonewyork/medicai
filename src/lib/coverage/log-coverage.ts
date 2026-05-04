import type {
  CoverageGap,
  CoverageSnoozeRow,
  EngagementState,
} from "~/types/coverage";
import type { DailyEntry, Settings, ZoneAlert } from "~/types/clinical";
import type { CycleContext } from "~/types/treatment";
import {
  TRACKED_FIELDS,
  type TrackedField,
} from "~/config/tracked-fields";
import {
  AGENT_VOICES,
  type AgentVoice,
} from "~/config/agent-cadence";
import { shiftIsoDate } from "~/lib/utils/date";
import {
  classifyEngagement,
  coverageCapForState,
} from "./engagement-state";

// Pure gap detector. Walks TRACKED_FIELDS, drops anything ineligible
// (eligibility check + snooze + already-logged-this-window), then
// caps to the engagement state's daily quota. Calm by default — never
// surfaces fields the patient has never touched (history_only) and
// never surfaces ANY coverage card during a rough patch.

export interface CoverageInputs {
  todayISO: string;
  // Last ~28 days of entries — we only need 60d for history checks
  // and 7d for engagement, but the 28d window already loaded by the
  // dashboard is plenty.
  recentDailies: readonly DailyEntry[];
  settings: Settings | null;
  cycleContext: CycleContext | null;
  activeAlerts: readonly ZoneAlert[];
  // Active snoozes — rows whose snoozed_until is still in the future.
  // The composer reads from Dexie and passes them in; this module
  // stays pure.
  snoozes: readonly CoverageSnoozeRow[];
}

export interface CoverageResult {
  engagement: EngagementState;
  gaps: CoverageGap[];
}

const HISTORY_LOOKBACK_DAYS = 60;
const DEFAULT_PRIORITY = 50;
const NADIR_PRIORITY = 40;

export function computeCoverageGaps(
  inputs: CoverageInputs,
): CoverageResult {
  const engagement = classifyEngagement({
    todayISO: inputs.todayISO,
    recentDailies: inputs.recentDailies,
    activeAlerts: inputs.activeAlerts,
  });
  const cap = coverageCapForState(engagement);
  if (cap === 0) return { engagement, gaps: [] };

  const todayEntry =
    inputs.recentDailies.find((d) => d.date === inputs.todayISO) ?? null;
  const trackedSymptoms = inputs.settings?.tracked_symptoms ?? [];
  const snoozedFields = activeSnoozeKeys(inputs.snoozes, inputs.todayISO);
  const inNadir = inputs.cycleContext?.phase?.key === "nadir";

  const candidates: CoverageGap[] = [];
  for (const field of TRACKED_FIELDS) {
    if (snoozedFields.has(field.key)) continue;
    if (
      !isEligible({
        field,
        trackedSymptoms,
        recentDailies: inputs.recentDailies,
        inNadir,
        todayISO: inputs.todayISO,
      })
    )
      continue;
    if (isFreshlyLogged(field, inputs.recentDailies, todayEntry, inputs.todayISO))
      continue;

    candidates.push(toGap(field, inNadir));
    if (candidates.length >= cap) break;
  }

  return { engagement, gaps: candidates };
}

function activeSnoozeKeys(
  snoozes: readonly CoverageSnoozeRow[],
  todayISO: string,
): Set<string> {
  const out = new Set<string>();
  for (const s of snoozes) {
    if (s.snoozed_until > todayISO) out.add(s.field_key);
  }
  return out;
}

interface EligibilityArgs {
  field: TrackedField;
  trackedSymptoms: readonly string[];
  recentDailies: readonly DailyEntry[];
  inNadir: boolean;
  todayISO: string;
}

function isEligible(args: EligibilityArgs): boolean {
  switch (args.field.eligibility) {
    case "default":
      return true;
    case "tracked_symptoms":
      return args.trackedSymptoms.includes(args.field.key);
    case "history_only":
      return hasHistoryWithin(
        args.field,
        args.recentDailies,
        args.todayISO,
        HISTORY_LOOKBACK_DAYS,
      );
    case "nadir_only":
      return args.inNadir;
  }
}

function hasHistoryWithin(
  field: TrackedField,
  dailies: readonly DailyEntry[],
  todayISO: string,
  windowDays: number,
): boolean {
  const cutoff = shiftIsoDate(todayISO, -windowDays);
  for (const d of dailies) {
    if (d.date < cutoff || d.date > todayISO) continue;
    if (anyFieldFilled(d, field.daily_keys)) return true;
  }
  return false;
}

function isFreshlyLogged(
  field: TrackedField,
  dailies: readonly DailyEntry[],
  todayEntry: DailyEntry | null,
  todayISO: string,
): boolean {
  if (field.freshness_days === 1) {
    return todayEntry !== null && anyFieldFilled(todayEntry, field.daily_keys);
  }
  const cutoff = shiftIsoDate(todayISO, -(field.freshness_days - 1));
  for (const d of dailies) {
    if (d.date < cutoff || d.date > todayISO) continue;
    if (anyFieldFilled(d, field.daily_keys)) return true;
  }
  return false;
}

function anyFieldFilled(
  d: DailyEntry,
  keys: ReadonlyArray<keyof DailyEntry>,
): boolean {
  for (const k of keys) {
    const v = d[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return true;
  }
  return false;
}

function toGap(field: TrackedField, inNadir: boolean): CoverageGap {
  const voice: AgentVoice = AGENT_VOICES[field.voice];
  const priority =
    field.eligibility === "nadir_only" && inNadir
      ? NADIR_PRIORITY
      : DEFAULT_PRIORITY;
  return {
    id: `coverage_${field.key}`,
    field_key: field.key,
    priority,
    title: voice.display_name,
    body: field.prompt,
    why: field.why,
    cta_href: `/daily/new?step=${encodeURIComponent(field.cta_step)}`,
    icon: voice.icon,
  };
}

