import type {
  BridgeInputs,
  BridgeStatus,
  EligibilityCriteria,
  Shortlist,
  TrialStatus,
  TrialVerdict,
} from "./types";

interface Args {
  inputs: BridgeInputs;
  shortlist: Shortlist;
  // NCT-ID → parsed criteria. Only NCTs whose JSON has been hand-
  // verified into a fixture are present; unverified or absent entries
  // route to "unknown".
  parsedByNct?: Map<string, EligibilityCriteria>;
}

export function getCurrentBridgeStatus({
  inputs,
  shortlist,
  parsedByNct = new Map(),
}: Args): BridgeStatus {
  const trials: TrialStatus[] = shortlist.map((entry) => {
    if (!entry.verified) {
      return {
        nct_id: entry.nct_id,
        trial_label: entry.label,
        verdict: { kind: "unknown", reason: "not yet hand-verified" },
        verified: false,
      };
    }
    if (entry.nct_id === "TBD") {
      return {
        nct_id: entry.nct_id,
        trial_label: entry.label,
        verdict: { kind: "unknown", reason: "NCT ID not yet recorded" },
        verified: true,
      };
    }
    const criteria = parsedByNct.get(entry.nct_id);
    if (!criteria) {
      return {
        nct_id: entry.nct_id,
        trial_label: entry.label,
        verdict: {
          kind: "unknown",
          reason: "verified but eligibility JSON not parsed yet",
        },
        verified: true,
      };
    }
    return {
      nct_id: entry.nct_id,
      trial_label: entry.label,
      verdict: evaluateVerdict(inputs, criteria),
      verified: true,
    };
  });

  return {
    as_of: inputs.as_of,
    inputs,
    trials,
    any_eligible_now: trials.some((t) => t.verdict.kind === "eligible_now"),
    any_eligible_if_stable: trials.some(
      (t) => t.verdict.kind === "eligible_if_stable",
    ),
    unverified_count: trials.filter((t) => !t.verified).length,
  };
}

function evaluateVerdict(
  inputs: BridgeInputs,
  criteria: EligibilityCriteria,
): TrialVerdict {
  const blocking: string[] = [];
  const concerns: string[] = [];

  // ECOG.
  if (criteria.ecog_max != null && inputs.ecog > criteria.ecog_max) {
    blocking.push(
      `ECOG ${inputs.ecog} exceeds trial cap of ${criteria.ecog_max}`,
    );
  }

  // KRAS.
  const krasReq = criteria.biomarker_requirements.kras_mutation;
  if (krasReq === "excluded" && inputs.kras_variant !== "wildtype") {
    blocking.push("KRAS-mutant excluded by trial");
  }
  if (krasReq !== "any" && krasReq !== "not_required" && krasReq !== "excluded") {
    if (inputs.kras_variant === "unknown") {
      concerns.push("KRAS variant unknown — trial requires confirmed status");
    } else if (
      krasReq === "any_g12" &&
      !inputs.kras_variant.startsWith("G12")
    ) {
      blocking.push(
        `Trial requires KRAS G12-family; patient is ${inputs.kras_variant}`,
      );
    } else if (
      ["g12d", "g12c", "g12v", "g12r"].includes(krasReq) &&
      inputs.kras_variant.toLowerCase() !== krasReq
    ) {
      blocking.push(
        `Trial requires KRAS ${krasReq.toUpperCase()}; patient is ${inputs.kras_variant}`,
      );
    }
  }

  // MTAP.
  const mtapReq = criteria.biomarker_requirements.mtap_deletion;
  if (mtapReq === "required") {
    if (inputs.mtap_status === "intact") {
      blocking.push("MTAP intact; trial requires deletion");
    } else if (inputs.mtap_status === "unknown") {
      concerns.push("MTAP status unknown — trial requires confirmed deletion");
    }
  }
  if (mtapReq === "excluded" && inputs.mtap_status === "deleted") {
    blocking.push("MTAP-deletion excluded by trial");
  }

  // HLA.
  const hla = criteria.biomarker_requirements.hla_restriction;
  if (hla && hla.length > 0) {
    const have = inputs.hla_types ?? [];
    if (have.length === 0) {
      concerns.push(
        `HLA typing not recorded; trial requires ${hla.join(" or ")}`,
      );
    } else if (!hla.some((allele) => have.includes(allele))) {
      blocking.push(
        `HLA mismatch; trial requires ${hla.join(" or ")}, patient has ${have.join(", ")}`,
      );
    }
  }

  // Labs.
  type LabKey = keyof BridgeInputs["latest_labs"];
  const checkFloor = (key: LabKey, threshold: number | null, label: string) => {
    if (threshold == null) return;
    const v = inputs.latest_labs[key];
    if (v == null) {
      concerns.push(`${label} not recorded — trial floor ${threshold}`);
    } else if (v < threshold) {
      blocking.push(`${label} ${v} below trial floor ${threshold}`);
    }
  };
  const checkCeil = (key: LabKey, threshold: number | null, label: string) => {
    if (threshold == null) return;
    const v = inputs.latest_labs[key];
    if (v == null) {
      concerns.push(`${label} not recorded — trial ceiling ${threshold}`);
    } else if (v > threshold) {
      blocking.push(`${label} ${v} above trial ceiling ${threshold}`);
    }
  };

  const t = criteria.lab_thresholds;
  checkFloor("anc_x10e9_per_L", t.anc_min_x10e9_per_L, "ANC");
  checkFloor("platelets_x10e9_per_L", t.platelets_min_x10e9_per_L, "Platelets");
  checkFloor("hb_g_per_L", t.hb_min_g_per_L, "Hb");
  checkCeil("bilirubin_xULN", t.bilirubin_max_xULN, "Bilirubin");
  checkCeil("alt_xULN", t.alt_max_xULN, "ALT");
  checkCeil("ast_xULN", t.ast_max_xULN, "AST");
  checkFloor("creatinine_clearance_mL_per_min", t.creatinine_clearance_min_mL_per_min, "CrCl");
  checkFloor("albumin_g_per_L", t.albumin_min_g_per_L, "Albumin");

  if (blocking.length > 0) return { kind: "excluded", blocking };
  if (concerns.length > 0) return { kind: "eligible_if_stable", concerns };
  return { kind: "eligible_now" };
}
