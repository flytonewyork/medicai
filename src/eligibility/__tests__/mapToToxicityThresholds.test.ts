import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { mapToToxicityThresholds } from "../mapToToxicityThresholds";
import type { EligibilityCriteria } from "../types";

const baseCriteria: EligibilityCriteria = {
  nct_id: "NCT06625320",
  key_inclusions: [],
  key_exclusions: [],
  ecog_max: 1,
  lab_thresholds: {
    anc_min_x10e9_per_L: 1.5,
    platelets_min_x10e9_per_L: 100,
    hb_min_g_per_L: 90,
    bilirubin_max_xULN: 1.5,
    alt_max_xULN: 2.5,
    ast_max_xULN: 2.5,
    creatinine_clearance_min_mL_per_min: 50,
    albumin_min_g_per_L: null,
  },
  biomarker_requirements: {
    kras_mutation: "any_g12",
    mtap_deletion: "not_required",
    hla_restriction: null,
    brca_or_hrd: "not_required",
  },
  au_sites: [],
  status: "Recruiting",
  last_verified_at: "2026-05-08",
  verified: false,
  source_quote: "test",
};

describe("mapToToxicityThresholds", () => {
  it("emits one constraint per non-null lab threshold + ECOG", () => {
    const map = mapToToxicityThresholds(baseCriteria);
    const fields = map.constraints.map((c) => c.field);
    expect(fields).toContain("ecog");
    expect(fields).toContain("anc_x10e9_per_L");
    expect(fields).toContain("platelets_x10e9_per_L");
    expect(fields).toContain("bilirubin_xULN");
    // albumin was null — should not appear.
    expect(fields).not.toContain("albumin_g_per_L");
  });

  it("uses orange as the breach zone (mandatory-conversation, not silent-red)", () => {
    const map = mapToToxicityThresholds(baseCriteria);
    for (const c of map.constraints) {
      expect(c.breach_zone).toBe("orange");
    }
  });

  it("preserves the trial NCT for downstream display", () => {
    const map = mapToToxicityThresholds(baseCriteria);
    expect(map.trial_nct_id).toBe("NCT06625320");
  });

  it("emits no constraints when criteria are entirely null", () => {
    const empty: EligibilityCriteria = {
      ...baseCriteria,
      ecog_max: null,
      lab_thresholds: {
        anc_min_x10e9_per_L: null,
        platelets_min_x10e9_per_L: null,
        hb_min_g_per_L: null,
        bilirubin_max_xULN: null,
        alt_max_xULN: null,
        ast_max_xULN: null,
        creatinine_clearance_min_mL_per_min: null,
        albumin_min_g_per_L: null,
      },
    };
    const map = mapToToxicityThresholds(empty);
    expect(map.constraints).toHaveLength(0);
  });

  it("uses ≥ for floors (ANC, platelets, Hb, CrCl) and ≤ for ceilings (bili, ALT, AST)", () => {
    const map = mapToToxicityThresholds(baseCriteria);
    const byField = new Map(map.constraints.map((c) => [c.field, c]));
    expect(byField.get("anc_x10e9_per_L")!.operator).toBe("≥");
    expect(byField.get("platelets_x10e9_per_L")!.operator).toBe("≥");
    expect(byField.get("hb_g_per_L")!.operator).toBe("≥");
    expect(byField.get("creatinine_clearance_mL_per_min")!.operator).toBe("≥");
    expect(byField.get("bilirubin_xULN")!.operator).toBe("≤");
    expect(byField.get("alt_xULN")!.operator).toBe("≤");
    expect(byField.get("ast_xULN")!.operator).toBe("≤");
    expect(byField.get("ecog")!.operator).toBe("≤");
  });
});

describe("Layer 1 firewall — mapToToxicityThresholds source", () => {
  it("has no runtime import from ~/lib/rules", async () => {
    const src = await readFile(
      "src/eligibility/mapToToxicityThresholds.ts",
      "utf-8",
    );
    const lines = src.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ") && trimmed.includes("lib/rules")) {
        if (!trimmed.startsWith("import type ")) {
          throw new Error(`Layer 1 runtime import detected: ${trimmed}`);
        }
      }
    }
  });
});
