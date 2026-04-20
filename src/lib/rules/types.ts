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

export interface ClinicalSnapshot {
  settings: Settings | null;
  latestDaily: DailyEntry | null;
  recentDailies: DailyEntry[];
  recentWeeklies: WeeklyAssessment[];
  latestFortnightly: FortnightlyAssessment | null;
  recentLabs: LabResult[];
  openPendingResults: PendingResult[];
  now: Date;
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
