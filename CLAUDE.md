# Anchor — bridge-strategy doctrine

This file is the **root doctrine** for Anchor, the n=1 clinical care platform
built for **HL** (de-identified internally; one patient, one operator).
It encodes the bridge-strategy hypothesis, the four-layer architecture,
the trial shortlist Layer 2 maintains, the operative variable, and the
hard guardrails on autonomy.

For app-internal doctrine (zone engine internals, single-channel patient
UX, build philosophy, build order, project-board norms, known traps) see
`.claude/CLAUDE.md`. Both files are loaded by Claude Code; this one
governs *strategy*, that one governs *implementation*.

---

## 1 — Patient brief (internal, de-identified)

- **Patient code:** HL.
- **Diagnosis:** confirmed metastatic pancreatic ductal adenocarcinoma
  (mPDAC).
- **First-line treatment:** gemcitabine + nab-paclitaxel (GnP), tuned for
  function preservation over maximum response.
- **Operator:** the patient's adult child, MBBS, sole builder of this
  platform. **No clinicians are contributors.**
- **Treating medical oncologist:** A/Prof Sumitra Ananda (Peter MacCallum
  Cancer Centre, Melbourne).
- **HPB surgeon:** Mark Cullinan (Epworth Richmond).
- **Carer (named):** Catherine.

Dates of birth, addresses, MRNs, real lab values, real imaging, real
free text from the patient, and any other clinical identifiers must
**never** enter the repo, a deployed environment, or an MCP server's
persistent storage. Tests, committed configs, and example files use
placeholders only. Real clinical values live in `anchor.local.json`
(gitignored) and stay on the operator's machine. The patient's name
and the named clinicians appear in this strategy doctrine because they
are facts about the care team, not patient clinical data; in code,
configs, and tests the patient is referenced as `HL`.

---

## 2 — Hypothesis (verbatim)

> Detecting treatment-driven toxicity (axis 3) early enough preserves
> ECOG performance status and keeps Hu Lin eligible to bridge from
> gemcitabine + nab-paclitaxel onto daraxonrasib (RMC-6236) when
> RASolute 302 readout (mOS 13.2 vs 6.7 mo, HR 0.40, FDA Breakthrough,
> announced 13 April 2026) translates into expanded access in
> Australia.

Source: project brief, April 2026. Trial readout figures `[VERIFY]`
against the RASolute 302 primary publication once available.

---

## 3 — Axis taxonomy

ECOG performance status is the sum of three independent axes. Standard
oncology monitors axes 1 and 2; Anchor's product focus is axis 3.

| Axis | What it is | Who watches it | Reversibility |
|---|---|---|---|
| **1** | Disease / tumour state — measurable on imaging, CA 19-9, ctDNA. | Treating team. Read-only context for Anchor. | Improves with response; worsens with progression. |
| **2** | Treatment response — symptomatic improvement attributable to chemo working. | Treating team. Read-only context for Anchor. | Reversible with response or progression. |
| **3** | **Treatment-driven toxicity** — neuropathy, sarcopenia, mucositis, FN, marrow suppression. | **Anchor.** This is the platform's job. | Often **irreversible** once entrenched (especially neuropathy and lean-mass loss). |

Layer 1 (the toxicity engine, already built — see `src/lib/rules/` and
`src/agents/{toxicity,clinical,nutrition,treatment,psychology,
rehabilitation}/`) is the axis-3 watcher. Layers 2–4 (this Phase 1 and
beyond) make the axis-3 signal actionable against the bridge-eligibility
horizon.

---

## 4 — Architecture: four layers

Anchor is a four-layer system. **Phase 1 builds the foundation and
Layer 2 v0.**

| # | Layer | State in repo | Phase |
|---|---|---|---|
| 1 | **Toxicity engine** — zone rules, axis-3 detectors, discipline agents (AI Nurse, clinical, nutrition, treatment, psychology, rehabilitation). | **Already core.** Lives in `src/lib/rules/` and `src/agents/*`. **Do not modify in Phase 1.** | Built. |
| 2 | **Eligibility engine** — maintains the live trial shortlist, parses each trial's eligibility criteria into structured rules, maps each trial's exclusion criteria back into Layer 1's alert thresholds, and exposes `getCurrentBridgeStatus(BridgeInputs)`. | **New. v0 in Phase 1.** Lives in `src/eligibility/`. | Phase 1. |
| 3 | **Literature surveillance** — watches RASolute 302, daraxonrasib, KRAS-on inhibitor, PDAC trial corpora; surfaces deltas relevant to HL's bridge plan. | Not yet started. | Phase 2. |
| 4 | **Visit prep** — translates the cumulative Layer 1–3 state into a 1-page brief for the next clinic visit. | Not yet started. | Phase 3. |

Layer 2's only runtime touch into Layer 1 is **types-only** (importing
`PatientStateSnapshot` from `src/lib/state` and `Zone` /
`RuleCategory` from `src/types/clinical`). Layer 2 must never mutate the
rule registry, the patient state, or any agent's role.

---

## 5 — Trial shortlist (Layer 2 maintains)

Six entries. Every clinical claim below is `[VERIFY]` until cross-checked
against the primary protocol and ClinicalTrials.gov record. The
machine-readable shortlist lives at `src/eligibility/shortlist.yaml`
with a per-trial `verified: false` flag; `getCurrentBridgeStatus`
**refuses to return an eligibility verdict for unverified entries** —
it returns `unknown` with a "not yet hand-verified" reason. Verification
is a single-trial-at-a-time human action by the operator.

| # | Trial | NCT | One-line eligibility shape |
|---|---|---|---|
| 1 | **RASolute 302 EAP** (RMC-6236, daraxonrasib) | NCT06625320 `[VERIFY]` | 2L mPDAC after first-line gem-based chemo; ECOG 0–1; KRAS-mutant (G12-anything most likely); EAP availability in AU is the **operative variable**. `[VERIFY]` |
| 2 | **MTAPESTRY 103 Sub C** (AMG193 + RMC-6236) | NCT06360354 `[VERIFY]` | Solid tumours including PDAC; **MTAP-deletion required**; KRAS-mutant; ECOG 0–1; 2L+. `[VERIFY]` |
| 3 | **MRTX1133** (KRAS G12D selective inhibitor) | NCT05737706 `[VERIFY]` | Advanced solid tumours including PDAC; **KRAS G12D required**; ECOG 0–1. `[VERIFY]` |
| 4 | **IMCODE003** (autogene cevumeran) | NCT05968326 `[VERIFY]` | PDAC adjuvant currently; **HLA-restricted**; ECOG 0–1. May not match HL's metastatic setting. `[VERIFY]` |
| 5 | **Epworth Jreissati — narmafotinib + mFOLFIRINOX** | NCT TBD `[VERIFY]` | Untreated mPDAC; ECOG 0–1; AU site (Epworth Richmond). `[VERIFY]` |
| 6 | **Epworth Jreissati — CEND-1 / LSTA1** | NCT TBD `[VERIFY]` | mPDAC with chemo backbone; ECOG 0–1; AU site. `[VERIFY]` |
| 7 | **Epworth Jreissati — pembrolizumab + olaparib** | NCT TBD `[VERIFY]` | mPDAC with platinum backbone, BRCA / HRD signal; ECOG 0–1. `[VERIFY]` |

(Strictly seven entries — the brief said "six-ish trials" and listed
four NCTs plus three Jreissati actives. Operator chooses whether to
collapse the Jreissati three to a single placeholder during
verification.)

---

## 6 — Operative variable: the AU EAP timeline for RMC-6236

Treat the date that daraxonrasib (RMC-6236) becomes available in
Australia via expanded access **as the reference horizon against which
every toxicity threshold is calibrated**. The exact date is currently
unknown.

It is modelled as a single configurable variable
`eap_au_open_date`. Today's value is `unknown` (not a date). When set,
the eligibility engine reads it and tightens the axis-3 alert thresholds
proportionally to the time-to-bridge:

- **EAP open today** → alert thresholds at "any drift" (zero tolerance
  for further axis-3 loss; the bridge starts now).
- **EAP > 6 months out** → alert thresholds at standard CTCAE grade-2
  warning, grade-3 escalation.
- **EAP unknown** → use a default conservative profile (the same as
  "EAP within 3–6 months").

Consequence: the engine's axis-3 sensitivity is a **function of
calendar time relative to the bridge horizon**, not a static rule.

---

## 7 — Guardrails (hard, not negotiable)

1. **Never autonomous.** The platform never sends, posts, drafts, or
   publishes anything to anyone outside the operator's local environment.
   Crossing a zone threshold triggers a **mandatory conversation**, not
   an automated action. The decision is not predetermined. The
   `.claude/hooks/block-outbound-comms.sh` PreToolUse hook is the
   second-line failsafe; the first line is not wiring outbound tools
   into any subagent or skill at all.
2. **n = 1 only.** No `patient_id` abstractions, no multi-tenant
   scaffolding, no "future user" generalisation. The single-patient
   design is the moat. If a feature would only make sense for a fleet
   of patients, it does not belong here.
3. **Patient data does not leave the device.** Real lab values, real
   imaging, real free text from HL stays in `anchor.local.json` or in
   the operator's local Dexie/Supabase instance (Supabase is a private
   project, not a shared service). It is never committed, never sent to
   a third-party MCP server, never echoed in test fixtures.
4. **No deploy in Phase 1.** No push to `main`. No Vercel changes. No
   workflow changes. Local-only.
5. **Cite or mark.** Every clinical claim in CLAUDE.md, skill files,
   and `shortlist.yaml` is either cited (primary protocol, NCCN, CTCAE
   reference) or tagged `[VERIFY]` inline.
6. **Don't touch Layer 1.** If existing Layer 1 code conflicts with a
   Phase 1 plan, surface the conflict — do not refactor around it.
7. **Use existing MCPs.** Do not write a custom ClinicalTrials.gov
   client. Layer 2 reads via the cyanheads ClinicalTrials.gov MCP and
   the GenomOncology BioMCP, both wired in `.mcp.json`.

---

## 8 — Disclosure status (TODO — flagged)

> **Prof. Ananda has not been informed that this tracking platform
> exists.** Decision pending. Until then: zero outbound communication,
> no shareable artefacts that name her, no claims about clinical
> recommendation in any export. The same applies to Mark Cullinan and
> any other treating clinician.

This is a clinical-relationship decision, not a technical one. The
operator owns the timing and framing of disclosure. The platform's job
is to **not pre-empt that decision** — by being silent, local, and
non-communicating until told otherwise.

---

## 9 — Phase 1 scope (what's in flight)

Phase 1 builds the foundation and Layer 2 v0. Scope is narrow and
exclusive:

1. This file.
2. `.claude/{agents,skills,hooks,evals}/` directory tree with READMEs.
3. MCP wiring for ClinicalTrials.gov (cyanheads, hosted) and BioMCP
   (GenomOncology, hosted) added to `.mcp.json` alongside the existing
   Supabase entry.
4. `.claude/skills/pdac-trial-eligibility-parse/SKILL.md` — emits the
   structured JSON shape used by `src/eligibility/`.
5. `.claude/agents/trial-monitor.md` — fresh-context subagent,
   restricted tool allow-list (CT.gov MCP read tools + BioMCP read tools
   + Read; **no** Write, Edit, Bash, or any outbound-comms surface).
6. `.claude/hooks/block-outbound-comms.sh` registered in
   `.claude/settings.json` as a PreToolUse hook.
7. `.claude/evals/cases/` with five YAML cases + fixtures + runner.
8. `src/eligibility/` Layer 2 v0:
   `parseEligibility(nctId)`,
   `mapToToxicityThresholds(criteria)`,
   `getCurrentBridgeStatus(bridgeInputs)`,
   `diffShortlistSnapshots(prev, next)`.
9. `.gitignore` covering `anchor.local.json`, `.claude/local/`,
   `*.patient.json`, `eval-runs/`.
10. `package.json` scripts: `eligibility:parse`, `evals:run`. (No
    `trial-monitor:run` — the subagent is the runnable artefact;
    invoke it from inside Claude Code.)

What's explicitly **not** in Phase 1: literature surveillance, visit
prep, any deploy step, any Layer 1 modification, any Vercel /
GitHub Actions change.

---

## 10 — Cross-references

- `.claude/CLAUDE.md` — app-internal doctrine, build order, single-
  channel patient UX, known traps.
- `docs/CLINICAL_FRAMEWORK.md` — clinical reasoning behind the axes.
- `docs/BRIDGE_STRATEGY.md` — operator's narrative of the bridge plan.
- `docs/ZONE_RULES.md` — Layer 1 zone-rule catalogue.
- `docs/DATA_SCHEMA.md` — Dexie / Supabase schema, sync semantics.
- `src/lib/state/types.ts` — `PatientStateSnapshot`, the type-only seam
  Layer 2 reads.
- `src/eligibility/shortlist.yaml` — the live trial shortlist.

When in doubt about clinical thresholds: ask, do not invent. When in
doubt about whether something is an outbound action: don't do it.
