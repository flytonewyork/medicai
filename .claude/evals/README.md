# Evals

Phase 1 eval harness for the eligibility engine and shortlist-monitor
delta logic.

## Layout

```
.claude/evals/
├── cases/         YAML — one case per file. Self-describing.
├── fixtures/      JSON — frozen ClinicalTrials.gov-shaped records and
│                  monitor snapshots used by cases.
└── runner.ts      Loads every case, executes against src/eligibility/,
                   writes results to eval-runs/<timestamp>.json (gitignored).
```

Run: `pnpm evals:run`.

## Case shape

```yaml
id: 03-mtap-unknown-kras-g12v
description: One sentence on what's being tested.
kind: bridge_status | shortlist_diff | eligibility_parse
inputs:
  # kind-specific
expect:
  # kind-specific assertions
```

Cases that hit the eligibility engine pass `BridgeInputs` (the thin
projection — ECOG, KRAS, MTAP, HLA, latest labs, treatment setting,
EAP-open flag) and assert on the `BridgeStatus` shape returned. Cases
that hit the monitor diff pass two snapshot fixtures and assert on
`diffShortlistSnapshots` output.

## Phase 1 success bar

The runner executes all five cases, pass/fail recorded honestly. A case
failing in Phase 1 is acceptable — it documents the gap. What's NOT
acceptable is the runner crashing or skipping cases silently.

## Outputs

`eval-runs/<ISO-timestamp>.json` is gitignored. Contains: timestamp,
git SHA, per-case pass/fail/skip + notes, summary line.
