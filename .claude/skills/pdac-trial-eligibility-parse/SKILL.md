---
name: pdac-trial-eligibility-parse
description: When parsing a shortlisted PDAC trial's eligibility criteria into the structured JSON shape that src/eligibility/parseEligibility.ts consumes. Triggers when the operator (or trial-monitor subagent) asks to extract eligibility for an NCT in the Anchor shortlist.
---

# Skill — pdac-trial-eligibility-parse

You convert a ClinicalTrials.gov record's free-text eligibility section
into a structured JSON object that Anchor's eligibility engine can
reason over without re-parsing prose.

## Trigger

The operator says any of:

- "parse eligibility for NCT…"
- "structure the eligibility criteria of NCT…"
- "update shortlist entry for NCT…"

Or: the `trial-monitor` subagent encounters a shortlist entry whose
parsed JSON is older than the trial's `LastUpdatePostDate`.

## Inputs

1. The NCT ID.
2. The trial's eligibility free text (from
   `mcp__clinicaltrials__get_study` → `EligibilityModule`).
3. Optional context from the operator (e.g. "interpret 'platinum
   backbone' permissively").

## Output (JSON, exact shape)

```json
{
  "nct_id": "NCT06625320",
  "key_inclusions": [
    "metastatic PDAC, histologically confirmed",
    "ECOG 0–1",
    "prior first-line gemcitabine-based therapy"
  ],
  "key_exclusions": [
    "active CNS metastases requiring steroids",
    "Grade ≥ 2 peripheral neuropathy at screening"
  ],
  "ecog_max": 1,
  "lab_thresholds": {
    "anc_min_x10e9_per_L": 1.5,
    "platelets_min_x10e9_per_L": 100,
    "hb_min_g_per_L": 90,
    "bilirubin_max_xULN": 1.5,
    "alt_max_xULN": 2.5,
    "ast_max_xULN": 2.5,
    "creatinine_clearance_min_mL_per_min": 50,
    "albumin_min_g_per_L": null
  },
  "biomarker_requirements": {
    "kras_mutation": "any_g12",
    "mtap_deletion": "not_required",
    "hla_restriction": null,
    "brca_or_hrd": "not_required"
  },
  "au_sites": [
    { "site_name": "TBD", "city": "Melbourne", "principal_investigator": "TBD" }
  ],
  "status": "Recruiting",
  "last_verified_at": "2026-05-08",
  "verified": false,
  "source_quote": "verbatim snippet from the EligibilityModule that justifies the structured fields above"
}
```

## Field rules

- `ecog_max` — integer 0–4. Highest ECOG that remains eligible. If the
  trial says "ECOG 0–1", `ecog_max: 1`.
- `lab_thresholds` — keys are SI-unit-suffixed; missing keys → `null`.
  Convert from US units (e.g. mg/dL bilirubin) using standard factors
  and note the conversion in `source_quote`.
- `biomarker_requirements.kras_mutation` — one of `any`, `any_g12`,
  `g12d`, `g12c`, `g12v`, `g12r`, `q61`, `not_required`, or `excluded`.
- `biomarker_requirements.mtap_deletion` — one of `required`,
  `not_required`, `excluded`.
- `biomarker_requirements.hla_restriction` — null OR an array of
  required HLA alleles (e.g. `["A*02:01"]`).
- `au_sites` — only sites in Australia. Empty array if none.
- `status` — verbatim from `OverallStatus` field.
- `verified` — **always emit `false` from this skill.** Verification
  is a human action by the operator, who flips it to `true` in
  `shortlist.yaml` after a one-trial-at-a-time hand-check.
- `source_quote` — verbatim text from the trial record that justifies
  the parse. Required, not optional.

## Failure modes

- **Eligibility free text missing or empty** → return the JSON shape
  with `key_inclusions: []`, `key_exclusions: []`, `ecog_max: null`,
  every `lab_thresholds` value `null`, and `source_quote: "EligibilityModule empty"`.
  Do not guess.
- **Ambiguous biomarker phrasing** ("KRAS-mutant solid tumours") →
  default to the most permissive interpretation that is unambiguously
  supported, and note the ambiguity in `source_quote`. Do not narrow
  to a specific allele unless the protocol names it.
- **Unit conversion uncertain** → set the field to `null` and quote
  the original phrasing in `source_quote`.

## What you do NOT do

- You do not write the JSON to disk. The operator pipes your output
  into `src/eligibility/__tests__/fixtures/<nct>.json` after review.
- You do not flip `verified: true`. Only the operator does that.
- You do not output anything else around the JSON — no Markdown
  preface, no commentary, no backticks. The output is a single
  parseable JSON object.
