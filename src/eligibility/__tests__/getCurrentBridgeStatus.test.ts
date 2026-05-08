import { describe, it, expect } from "vitest";
import { getCurrentBridgeStatus } from "../getCurrentBridgeStatus";
import type {
  BridgeInputs,
  EligibilityCriteria,
  Shortlist,
} from "../types";

const inputs: BridgeInputs = {
  ecog: 1,
  kras_variant: "G12V",
  mtap_status: "intact",
  treatment_setting: "first_line_active",
  latest_labs: {
    anc_x10e9_per_L: 2.0,
    platelets_x10e9_per_L: 150,
    hb_g_per_L: 110,
    bilirubin_xULN: 1.0,
    alt_xULN: 1.2,
    ast_xULN: 1.1,
    creatinine_clearance_mL_per_min: 80,
  },
  eap_au_open: false,
  as_of: "2026-05-08",
};

const rasolute: EligibilityCriteria = {
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
  verified: true,
  source_quote: "test",
};

describe("getCurrentBridgeStatus", () => {
  it("refuses to verdict unverified shortlist entries", () => {
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06625320",
        label: "RASolute 302 EAP",
        one_line_eligibility: "test",
        verified: false,
      },
    ];
    const result = getCurrentBridgeStatus({ inputs, shortlist });
    expect(result.trials).toHaveLength(1);
    expect(result.trials[0].verdict.kind).toBe("unknown");
    if (result.trials[0].verdict.kind === "unknown") {
      expect(result.trials[0].verdict.reason).toBe("not yet hand-verified");
    }
    expect(result.unverified_count).toBe(1);
    expect(result.any_eligible_now).toBe(false);
  });

  it("returns eligible_now when the patient passes all thresholds", () => {
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06625320",
        label: "RASolute 302 EAP",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const parsedByNct = new Map([["NCT06625320", rasolute]]);
    const result = getCurrentBridgeStatus({ inputs, shortlist, parsedByNct });
    expect(result.trials[0].verdict.kind).toBe("eligible_now");
    expect(result.any_eligible_now).toBe(true);
  });

  it("returns excluded when MTAP intact but trial requires deletion", () => {
    const mtapestry: EligibilityCriteria = {
      ...rasolute,
      nct_id: "NCT06360354",
      biomarker_requirements: {
        ...rasolute.biomarker_requirements,
        kras_mutation: "any",
        mtap_deletion: "required",
      },
    };
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06360354",
        label: "MTAPESTRY 103",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const parsedByNct = new Map([["NCT06360354", mtapestry]]);
    const result = getCurrentBridgeStatus({ inputs, shortlist, parsedByNct });
    expect(result.trials[0].verdict.kind).toBe("excluded");
    if (result.trials[0].verdict.kind === "excluded") {
      expect(result.trials[0].verdict.blocking.join(" ")).toMatch(/MTAP/);
    }
  });

  it("returns eligible_if_stable when MTAP unknown but trial requires deletion", () => {
    const mtapestry: EligibilityCriteria = {
      ...rasolute,
      nct_id: "NCT06360354",
      biomarker_requirements: {
        ...rasolute.biomarker_requirements,
        kras_mutation: "any",
        mtap_deletion: "required",
      },
    };
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06360354",
        label: "MTAPESTRY 103",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const parsedByNct = new Map([["NCT06360354", mtapestry]]);
    const unknownInputs: BridgeInputs = {
      ...inputs,
      mtap_status: "unknown",
    };
    const result = getCurrentBridgeStatus({
      inputs: unknownInputs,
      shortlist,
      parsedByNct,
    });
    expect(result.trials[0].verdict.kind).toBe("eligible_if_stable");
  });

  it("returns excluded when ECOG exceeds the trial cap", () => {
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06625320",
        label: "RASolute 302 EAP",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const parsedByNct = new Map([["NCT06625320", rasolute]]);
    const decliningInputs: BridgeInputs = { ...inputs, ecog: 2 };
    const result = getCurrentBridgeStatus({
      inputs: decliningInputs,
      shortlist,
      parsedByNct,
    });
    expect(result.trials[0].verdict.kind).toBe("excluded");
  });

  it("treats verified entries with TBD NCT IDs as unknown", () => {
    const shortlist: Shortlist = [
      {
        nct_id: "TBD",
        label: "Epworth Jreissati — narmafotinib",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const result = getCurrentBridgeStatus({ inputs, shortlist });
    expect(result.trials[0].verdict.kind).toBe("unknown");
    if (result.trials[0].verdict.kind === "unknown") {
      expect(result.trials[0].verdict.reason).toBe("NCT ID not yet recorded");
    }
  });

  it("treats verified entries without parsed criteria as unknown", () => {
    const shortlist: Shortlist = [
      {
        nct_id: "NCT06625320",
        label: "RASolute 302 EAP",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const result = getCurrentBridgeStatus({ inputs, shortlist });
    expect(result.trials[0].verdict.kind).toBe("unknown");
    if (result.trials[0].verdict.kind === "unknown") {
      expect(result.trials[0].verdict.reason).toMatch(/not parsed/);
    }
  });

  it("returns excluded when KRAS variant doesn't match a G12D-only trial", () => {
    const mrtx: EligibilityCriteria = {
      ...rasolute,
      nct_id: "NCT05737706",
      biomarker_requirements: {
        ...rasolute.biomarker_requirements,
        kras_mutation: "g12d",
      },
    };
    const shortlist: Shortlist = [
      {
        nct_id: "NCT05737706",
        label: "MRTX1133",
        one_line_eligibility: "test",
        verified: true,
      },
    ];
    const parsedByNct = new Map([["NCT05737706", mrtx]]);
    // inputs.kras_variant is G12V — should be excluded.
    const result = getCurrentBridgeStatus({ inputs, shortlist, parsedByNct });
    expect(result.trials[0].verdict.kind).toBe("excluded");
  });
});
