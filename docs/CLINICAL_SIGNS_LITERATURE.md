# Clinical Signs Literature — Layer 2 Detector Inputs

> Audience: detector engine designers and the rule-tuning loop.
> Purpose: ground each home-measurable signal in published literature so
> Bayesian priors, thresholds, and lead-time claims are not invented.
> Scope: Hu Lin, mPDAC on gemcitabine + nab-paclitaxel (MPACT schedule, days
> 1/8/15 of a 28-day cycle). Mission is detecting axis-3 (treatment toxicity)
> drift before ECOG decline breaks daraxonrasib trial eligibility.
> Cycle-curve coverage already in `src/config/cycle-curves.json`: ANC,
> platelets, hemoglobin, fatigue, nausea, neuropathy (within-cycle and
> cumulative), weight, albumin, ECOG, CA 19-9.

This document is the next layer: 13 home-measurable signals that are
published leading indicators of functional decline in chemotherapy and
cachexia populations. For each: literature, modality, lead time,
sensitivity/specificity if reported, recommended `n_effective` for
Bayesian priors (1-4 scale, where 1 = thin evidence, 4 = strong PDAC- or
cachexia-specific evidence), and concrete operationalisation.

`n_effective` rubric used throughout:
- 1 — analog literature only (geriatric oncology, generic cachexia, no
  chemo-specific or PDAC-specific data)
- 2 — chemo or cancer cohorts but small / mixed / non-PDAC
- 3 — PDAC or pancreatic-cancer specific cohort, or large chemo cohort
  with replicated thresholds
- 4 — PDAC chemotherapy cohort with prospective validation of the cutoff

---

## 1. Grip strength fatigability (morning vs afternoon delta)

**Literature.** Static peak handgrip strength (HGS) is the most-studied
single home-measurable predictor in oncology. EWGSOP2 dynapenia
thresholds are <27 kg (men) / <16 kg (women); Bourdel-Marchasson 2022
(FIGHTDIGOTOX, n=406 digestive cancers) found exploratory thresholds of
<34 kg (men) and <22 kg (women) better identified chemotherapy toxicity
risk, with low HGS predicting all-grade asthenia, anaemia, and dose-
limiting toxicity. Freckelton 2024 in PDAC specifically (n=158) showed
low HGS independently predicted PDAC-specific survival (HR 1.88,
95% CI 1.15–3.09, p=0.004), and this association held when muscle mass
on CT did not — i.e. function led mass. Across mixed cancer cohorts,
low HGS is associated with cancer mortality (HR ~1.5–1.9). Fatigability
specifically — the *delta* across repeated efforts or across the day —
is well validated in ME/CFS (Jäkel 2021: 10 reps × 2 sessions, 60-min
interval, Fatigue Ratio Fmax/Fmean and Recovery Ratio Fmean2/Fmean1)
but not yet PDAC-specific. The conceptual analog in oncology is that
neuromuscular fatigability worsens before peak strength does, so a
diurnal or repeat-rep delta should lead static HGS by weeks.

**Home modality.** Bluetooth dynamometer (Camry EH101 ~$30; Jamar Plus+
clinical-grade ~$400). Phone app records timestamp + value; three reps
each session, max recorded; AM session within 1 h of waking, PM session
6–10 h later. Burden ~60 s per session.

**Lead time.** Static HGS decline lags muscle-mass loss by weeks but
leads ECOG decline by an estimated 4–8 weeks based on cachexia
trajectory studies (no direct PDAC-on-GnP head-to-head). Fatigability
delta is hypothesised to lead static HGS by 2–4 weeks; treat as
exploratory.

**Sensitivity / specificity.** Not reported for fatigability delta in
oncology. For static HGS predicting grade ≥3 chemo toxicity in
FIGHTDIGOTOX: sensitivity ~60%, specificity ~65% at the exploratory
cutoffs.

**n_effective = 3** for static HGS (PDAC-specific, replicated
thresholds). **n_effective = 1** for the AM/PM delta (analog only).

**Operationalisation.** Twice-daily dynamometer reading (AM within 1 h
of waking, PM 6–10 h later). Three reps per session, max recorded.
Cycle-aware: expect a transient drop on day 2–4 post-infusion; the
detector's job is the 7- and 28-day moving average of (a) AM peak and
(b) PM/AM ratio. Caution thresholds: AM peak <34 kg sustained ×7 days;
PM/AM ratio <0.85 sustained ×7 days; AM peak drop >15% from personal
baseline over 28 days. Each triggers a yellow zone item on the unified
feed, prompting a sit-to-stand cross-check.

