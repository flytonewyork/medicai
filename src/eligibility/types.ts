// Layer 2 types. Read-only consumer of Layer 1 vocabulary
// (`Zone`, `RuleCategory`) — types-only imports, never runtime.

import type { Zone, RuleCategory } from "~/types/clinical";

// ---- BridgeInputs: thin projection consumed by getCurrentBridgeStatus.
// Deliberately decoupled from PatientStateSnapshot — Phase 1 doesn't
// have a real wiring path from the rich state model into trial
// eligibility. Build the wiring in Phase 2 once a real verification
// pass through the shortlist is done.

export type KrasVariant =
  | "G12V"
  | "G12D"
  | "G12C"
  | "G12R"
  | "Q61H"
  | "wildtype"
  | "unknown";

export type MtapStatus = "deleted" | "intact" | "unknown";

export type TreatmentSetting =
  | "first_line_active"
  | "first_line_progression"
  | "second_line"
  | "off_treatment";

export interface BridgeInputs {
  ecog: 0 | 1 | 2 | 3 | 4;
  kras_variant: KrasVariant;
  mtap_status: MtapStatus;
  hla_types?: string[];
  treatment_setting: TreatmentSetting;
  latest_labs: Partial<{
    anc_x10e9_per_L: number;
    platelets_x10e9_per_L: number;
    hb_g_per_L: number;
    bilirubin_xULN: number;
    alt_xULN: number;
    ast_xULN: number;
    creatinine_clearance_mL_per_min: number;
    albumin_g_per_L: number;
  }>;
  // Operative variable. true = expanded access for RMC-6236 is open
  // in Australia; false = not yet, or unknown.
  eap_au_open: boolean;
  as_of: string;
}

// ---- EligibilityCriteria: structured shape of a trial's eligibility
// section. Produced by the `pdac-trial-eligibility-parse` skill,
// consumed by getCurrentBridgeStatus + mapToToxicityThresholds.

export type KrasRequirement =
  | "any"
  | "any_g12"
  | "g12d"
  | "g12c"
  | "g12v"
  | "g12r"
  | "q61"
  | "not_required"
  | "excluded";

export type MtapRequirement = "required" | "not_required" | "excluded";

export interface LabThresholds {
  anc_min_x10e9_per_L: number | null;
  platelets_min_x10e9_per_L: number | null;
  hb_min_g_per_L: number | null;
  bilirubin_max_xULN: number | null;
  alt_max_xULN: number | null;
  ast_max_xULN: number | null;
  creatinine_clearance_min_mL_per_min: number | null;
  albumin_min_g_per_L: number | null;
}

export interface BiomarkerRequirements {
  kras_mutation: KrasRequirement;
  mtap_deletion: MtapRequirement;
  hla_restriction: string[] | null;
  brca_or_hrd: "required" | "not_required" | "excluded";
}

export interface AustralianSite {
  site_name: string;
  city: string;
  principal_investigator: string;
}

export interface EligibilityCriteria {
  nct_id: string;
  key_inclusions: string[];
  key_exclusions: string[];
  ecog_max: number | null;
  lab_thresholds: LabThresholds;
  biomarker_requirements: BiomarkerRequirements;
  au_sites: AustralianSite[];
  status: string;
  last_verified_at: string;
  verified: boolean;
  source_quote: string;
}

// ---- ToxicityThresholdMap: Layer 2's projection of trial constraints
// back into Layer 1's vocabulary. Layer 1 does NOT consume this in
// Phase 1 — the type is exported for Phase 2 wiring.

export interface ToxicityConstraint {
  category: RuleCategory;
  field: string;
  operator: "≤" | "≥" | "=" | "≠";
  value: number | string;
  breach_zone: Zone;
  rationale: string;
}

export interface ToxicityThresholdMap {
  trial_nct_id: string;
  constraints: ToxicityConstraint[];
}

// ---- BridgeStatus: per-trial verdict + aggregates.

export type TrialVerdict =
  | { kind: "eligible_now" }
  | { kind: "eligible_if_stable"; concerns: string[] }
  | { kind: "excluded"; blocking: string[] }
  | { kind: "unknown"; reason: string };

export interface TrialStatus {
  nct_id: string;
  trial_label: string;
  verdict: TrialVerdict;
  verified: boolean;
}

export interface BridgeStatus {
  as_of: string;
  inputs: BridgeInputs;
  trials: TrialStatus[];
  any_eligible_now: boolean;
  any_eligible_if_stable: boolean;
  unverified_count: number;
}

// ---- Monitor snapshots (consumed by diffShortlistSnapshots).

export interface ShortlistSnapshotTrial {
  nct_id: string;
  overall_status: string;
  last_update_post_date: string;
  au_site_count: number;
}

export interface ShortlistSnapshot {
  as_of: string;
  trials: ShortlistSnapshotTrial[];
}

export interface ShortlistDiff {
  new_trials: ShortlistSnapshotTrial[];
  closed_trials: ShortlistSnapshotTrial[];
  status_changes: Array<{ nct_id: string; from: string; to: string }>;
  site_changes: Array<{ nct_id: string; from: number; to: number }>;
  unchanged_count: number;
}

// ---- Shortlist file shape.

export interface ShortlistEntry {
  nct_id: string;
  label: string;
  one_line_eligibility: string;
  verified: boolean;
}

export type Shortlist = ShortlistEntry[];
