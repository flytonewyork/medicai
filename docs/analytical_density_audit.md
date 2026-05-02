# Analytical density audit — Sprint 2 Phase 0

**Date:** 2026-05-02
**Scope:** Hu Lin's cloud data, post-pipe-heal (PR #164 + RLS migrations).
**Purpose:** Decide which axis-3 metrics are dense enough for the V2 analytical-layer rules to operate on. Drives Phase 3 scope and Phase 4 validation timing.

## TL;DR

**The analytical-layer code is ready. The data isn't.** The pipe-heal recovered Hu Lin's bootstrap and started flowing dailies again, but every axis-3 metric the V2 rules expect to consume is either absent or critically sparse in the cloud right now. Phase 4 V2-vs-V1 validation cannot run until the data-capture surface is fixed and ~4–6 weeks of post-fix logging accumulates.

## Cloud state today

| Source | Rows | Date span | Comment |
|---|---|---|---|
| `daily_entries` | 4 | 2026-04-22, then 04-28→04-30 | 5-day gap (broken-pipe window) |
| `fortnightly_assessments` | **0** | — | No grip / gait / sarc-f / TUG / STS observations exist anywhere in cloud |
| `weekly_assessments` | 0 | — | |
| `quarterly_reviews` | 0 | — | |
| `treatment_cycles` | **0** | — | No active cycle → cycle-detrending unavailable for any metric |
| `voice_memos` | 0 (cloud) | — | Bucket was missing (now created in `2026_05_02_voice_memos_bucket`) |
| `medication_events` | 11 | All within 6 seconds, 2026-04-22 09:59:39–45 | Looks like onboarding/test clicks, not real GnP doses |
| `comprehensive_assessments` | 1 | 2026-04-22 | Single onboarding assessment |
| `labs` / `imaging` / `ctdna_results` | 0 | — | No clinical results imported |

## Per-metric density audit

| Metric | Source | Cycle curve in priors? | Obs in cloud | Verdict |
|---|---|---|---|---|
| **weight_kg** | `daily_entries.weight_kg` | yes (delta scale) | 3 of 4 days | Insufficient. Need ≥28 days for `slope_28d`. **Raw threshold only.** |
| **steps** | `daily_entries.steps` | no | **0 of 4 days** | Field never populated. Likely Android Health Connect not wired or permission denied. **V2 rule will never fire.** Investigate UX. |
| **grip_dominant_kg** | `fortnightly_assessments.grip_dominant_kg` | no | **0** | No fortnightly has been completed. Cadence is 14d → need 4–6 fortnightlies (8–12 weeks) for `slope_28d`. **V2 rule will never fire** without prompted fortnightly capture. |
| **gait_speed_ms** | `fortnightly_assessments.gait_speed_ms` | no | **0** | Same as grip. |
| **neuropathy_hands** | `daily_entries.neuropathy_hands` | yes (cumulative) | 1 of 4 days | Insufficient. |
| **neuropathy_feet** | `daily_entries.neuropathy_feet` | yes (cumulative) | 2 of 4 days | Insufficient. |
| **diarrhoea_count** | `daily_entries.diarrhoea_count` | no | 2 of 4 days | Insufficient. Cycle-day detrending impossible without active cycle anyway. |
| **bristol_score** | (no field on DailyEntry) | no | n/a | Not captured today. Spec'd in `docs/CLINICAL_FRAMEWORK.md` but no schema field. |
| **anc / hemoglobin / platelets / albumin** | `labs.*` | yes (population priors) | 0 | No labs imported via Records-import flow. |
| **fatigue_proctcae** | `daily_entries.energy` (proxy?) | yes | 3 of 4 days | Insufficient. |
| **nausea_proctcae** | `daily_entries.nausea` | yes | 3 of 4 days | Insufficient. |
| **ecog_self_rated** | `fortnightly_assessments.ecog_self` | yes | 0 | No fortnightly completed. |

## Cycle context

`treatment_cycles` is empty. Without an active cycle:
- `cycleDayFor()` returns `null` for every observation
- `residualSeries()` falls through to pass-through residuals (`value=0`, `expected_mean=raw`, `expected_sd=1`)
- `chronicResiduals()` returns the same pass-through
- Therefore `chronicSlope`, `residualBelowExpected`, `chronicMeanResidual` all return either 0 or null — they cannot detect drift on top of cycle variance because there's no cycle to subtract

The V2 grip/steps rules I shipped in Phase 3 use `patient_state.metrics.X.slope_28d` (raw values, not residuals), so they are **independent of cycle context** — they would still fire correctly if grip/steps had data. But for any metric that DOES have a cycle prior (anc, weight, fatigue, nausea, neuropathy), Phase 3c+ needs an active cycle to add value beyond raw thresholds.

## Critical data-capture gaps surfaced (NOT analytical issues — UX/wiring issues)

1. **Voice-memos bucket missing** — fixed today by `2026_05_02_voice_memos_bucket`. Hu Lin's primary input modality has been writing into a 400-error void since voice memos shipped. **High priority** to confirm this fix lands by triggering one voice memo on his next session.
2. **Steps never captured.** No daily entry has a `steps` value. The most important high-frequency objective axis-3 proxy. Either the daily form doesn't surface the field, or Android Health Connect / step source isn't wired. Would need to inspect `src/components/daily/daily-wizard.tsx` and the steps capture path.
3. **No fortnightly assessment ever completed.** Grip / gait / ECOG / sarc-f / TUG / STS are all gated on this form. The fortnightly is the function-preservation backbone of axis-3 monitoring. If Hu Lin hasn't completed one in 10+ days of trying to use the app, the prompt cadence is too gentle or the form is too long.
4. **No active treatment_cycle.** Either onboarding's "I'm currently on a protocol" checkbox was unticked, or it didn't persist. Without this, no cycle-detrending and no GnP-day-aware nudges work.
5. **No labs/imaging imported.** Records-import flow exists but Hu Lin hasn't pulled MHR / Epworth data yet.

## Recommendation — pivot Sprint 2

The original Sprint 2 plan was: helpers → shadow plumbing → V2 rule migration → validate diff with Thomas → flip live. Phases 1–3b are shipped and tested. **But Phase 4 (validate) has no signal to validate against and Phase 5 (flip) has nothing to flip.**

Suggested re-shape:

| Was | Becomes | Reason |
|---|---|---|
| Phase 4: Validate V2 vs V1 | **Phase 4a: Data-capture audit + fixes** | Voice memos, steps, fortnightly cadence, cycle setup, labs import |
| Phase 5: Flip V2 live | **Phase 4b: Wait + accumulate ≥4 weeks of post-fix data** | V2 rules need observations to compute slopes |
| (parked) | **Phase 5: Validate + flip** | Once data is flowing, Phase 4 validation becomes meaningful |

Concretely, the next analytical-layer-relevant work is **NOT** more rule code — it's:
- Confirm voice-memos pipeline now works end-to-end on Hu Lin's next open
- Verify `daily_wizard.tsx` actually surfaces steps and that the Android source wires through (likely Health Connect API)
- Tighten the fortnightly prompt cadence so Hu Lin completes one before mid-cycle
- Help Thomas seed Hu Lin's current treatment_cycle row (one-time data entry)
- Trigger a labs import (MHR sync) for the most recent CA19-9 / FBE / albumin

V2 rule code stands ready. It does its job the moment its inputs exist.

## Followups (already on the kanban)

- **#168** ✓ closed — pipe heal verified
- **#170** ⬅ this doc (closing)
- **#173** Phase 3 — partial (grip + steps shipped); rest blocked on data
- **#174** Phase 4 — re-scoped per above
- **#175** Phase 5 — re-scoped per above
- **#178** anon RPC lockdown — independent security cleanup

## Notes for Phase 4 (whenever it runs)

When Hu Lin has ≥28 days of post-fix data and an active cycle:
- Walk the diff dashboard with Thomas, confirming each `v2_only` fire matches his clinical read of Hu Lin's trajectory
- Tune `GRIP_SLOPE_YELLOW_KG_PER_DAY`, `GRIP_SLOPE_ORANGE_KG_PER_DAY`, `STEPS_SLOPE_YELLOW_PER_DAY`, `STEPS_SLOPE_ORANGE_PER_DAY` (top of `src/lib/rules/zone-rules-v2.ts`) against his actual cycle-fit
- Decide whether to retire each V1 rule individually or as a single cutover
