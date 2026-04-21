import type {
  DailyEntry,
  FortnightlyAssessment,
  LabResult,
  PendingResult,
  Settings,
  WeeklyAssessment,
  Zone,
  RuleCategory,
} from "~/types/clinical";
import type { PatientStateSnapshot } from "~/lib/state";

export interface ClinicalSnapshot {
  settings: Settings | null;
  latestDaily: DailyEntry | null;
  recentDailies: DailyEntry[];
  recentWeeklies: WeeklyAssessment[];
  latestFortnightly: FortnightlyAssessment | null;
  recentLabs: LabResult[];
  openPendingResults: PendingResult[];
  now: Date;
  // Four-axis patient state, computed alongside the snapshot. Slice 1 adds it
  // to the contract without consuming it in any rule; later slices migrate
  // rule evaluators onto this field.
  patient_state: PatientStateSnapshot;
}

export interface ZoneRule {
  id: string;
  name: string;
  zone: Exclude<Zone, "green">;
  category: RuleCategory;
  evaluator: (snapshot: ClinicalSnapshot) => boolean;
  recommendation: string;
  recommendationZh: string;
  triggersReview: boolean;
  suggestedLevers: string[];
}

export interface RuleEvaluationResult {
  rule: ZoneRule;
  triggered: boolean;
}
