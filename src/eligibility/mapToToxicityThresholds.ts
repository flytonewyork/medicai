import type { Zone, RuleCategory } from "~/types/clinical";
import type {
  EligibilityCriteria,
  ToxicityConstraint,
  ToxicityThresholdMap,
} from "./types";

// Pure function. Types-only imports from `~/types/clinical`. Never
// imports `~/lib/rules/*` at runtime — Layer 1 must remain decoupled.
// Each lab threshold becomes a constraint that, if breached, would
// disqualify the patient from this trial. `breach_zone` is set
// conservatively to "orange" — Layer 1 should surface the breach as a
// mandatory-conversation review item, not a silent-red automatic
// escalation. Phase 1 doesn't wire this back into Layer 1 yet; the
// function is exposed so Phase 2 can pick it up.

export function mapToToxicityThresholds(
  criteria: EligibilityCriteria,
): ToxicityThresholdMap {
  const constraints: ToxicityConstraint[] = [];
  const breach_zone: Zone = "orange";

  if (criteria.ecog_max != null) {
    const category: RuleCategory = "function";
    constraints.push({
      category,
      field: "ecog",
      operator: "≤",
      value: criteria.ecog_max,
      breach_zone,
      rationale: `Trial ${criteria.nct_id} requires ECOG ≤ ${criteria.ecog_max}`,
    });
  }

  const labCategory: RuleCategory = "toxicity";

  const labFloor = (field: string, val: number | null) => {
    if (val == null) return;
    constraints.push({
      category: labCategory,
      field,
      operator: "≥",
      value: val,
      breach_zone,
      rationale: `Trial ${criteria.nct_id} requires ${field} ≥ ${val}`,
    });
  };

  const labCeil = (field: string, val: number | null) => {
    if (val == null) return;
    constraints.push({
      category: labCategory,
      field,
      operator: "≤",
      value: val,
      breach_zone,
      rationale: `Trial ${criteria.nct_id} requires ${field} ≤ ${val}`,
    });
  };

  const t = criteria.lab_thresholds;
  labFloor("anc_x10e9_per_L", t.anc_min_x10e9_per_L);
  labFloor("platelets_x10e9_per_L", t.platelets_min_x10e9_per_L);
  labFloor("hb_g_per_L", t.hb_min_g_per_L);
  labCeil("bilirubin_xULN", t.bilirubin_max_xULN);
  labCeil("alt_xULN", t.alt_max_xULN);
  labCeil("ast_xULN", t.ast_max_xULN);
  labFloor("creatinine_clearance_mL_per_min", t.creatinine_clearance_min_mL_per_min);
  labFloor("albumin_g_per_L", t.albumin_min_g_per_L);

  return { trial_nct_id: criteria.nct_id, constraints };
}
