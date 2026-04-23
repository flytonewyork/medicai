import type { Locale } from "./clinical";

export type ProtocolId =
  | "gnp_weekly"
  | "gnp_biweekly"
  | "gem_maintenance"
  | "mffx"
  | "nalirifox"
  | "gnp_narmafotinib"
  | "custom";

export type NudgeCategory =
  | "diet"
  | "hygiene"
  | "exercise"
  | "sleep"
  | "mental"
  | "safety"
  | "activity"
  | "meds"
  | "intimacy";

export type NudgeSeverity = "info" | "caution" | "warning";

export type PhaseKey =
  | "dose_day"
  | "post_dose"
  | "recovery_early"
  | "nadir"
  | "recovery_late"
  | "rest"
  | "pre_dose";

export interface LocalizedText {
  en: string;
  zh: string;
}

export interface ProtocolAgent {
  id: string;
  name: string;
  display: LocalizedText;
  typical_dose: string;
  infusion_time_min?: number;
  dose_days: number[];
  route: "IV" | "PO" | "SC";
  notes?: LocalizedText;
}

export interface PhaseWindow {
  key: PhaseKey;
  day_start: number;
  day_end: number;
  label: LocalizedText;
  description: LocalizedText;
}

export interface Protocol {
  id: ProtocolId;
  name: LocalizedText;
  short_name: string;
  description: LocalizedText;
  cycle_length_days: number;
  agents: ProtocolAgent[];
  dose_days: number[];
  premeds?: LocalizedText;
  phase_windows: PhaseWindow[];
  side_effect_profile: LocalizedText;
  typical_supportive: string[];
}

export interface NudgeTemplate {
  id: string;
  protocol_ids: ProtocolId[];
  day_range: [number, number];
  category: NudgeCategory;
  severity: NudgeSeverity;
  title: LocalizedText;
  body: LocalizedText;
  if_symptom_flag?:
    | "fever"
    | "nausea"
    | "diarrhoea"
    | "neuropathy"
    | "low_appetite";
}

export type CycleStatus =
  | "planned"
  | "active"
  | "completed"
  | "delayed"
  | "cancelled";

export interface CycleDoseDayRecord {
  day: number;
  date: string;
  administered: boolean;
  dose_modification?: string;
  notes?: string;
}

export interface TreatmentCycle {
  id?: number;
  protocol_id: ProtocolId;
  custom_protocol?: Protocol;
  cycle_number: number;
  start_date: string;
  planned_end_date?: string;
  actual_end_date?: string;
  status: CycleStatus;
  dose_level: number;
  dose_modification_notes?: string;
  day_records?: CycleDoseDayRecord[];
  // Extra rest days appended to the cycle (e.g. a full +7 day gap because
  // bloods hadn't recovered). Honoured by `effectiveCycleLengthDays` so
  // the calendar view + linked appointments respect the delay without
  // mutating the protocol.
  rest_days_added?: number;
  snoozed_nudge_ids?: string[];
  dismissed_nudge_ids?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function effectiveCycleLengthDays(
  cycle: TreatmentCycle,
  protocol: Protocol,
): number {
  return protocol.cycle_length_days + Math.max(0, cycle.rest_days_added ?? 0);
}

export interface CycleContext {
  cycle: TreatmentCycle;
  protocol: Protocol;
  cycle_day: number;
  phase: PhaseWindow | null;
  is_dose_day: boolean;
  days_until_next_dose: number | null;
  days_until_nadir: number | null;
  applicable_nudges: NudgeTemplate[];
}

export function resolveProtocol(
  id: ProtocolId,
  custom?: Protocol,
  library?: readonly Protocol[],
): Protocol | undefined {
  if (id === "custom" && custom) return custom;
  return library?.find((p) => p.id === id);
}

export function localized(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? text.en;
}
