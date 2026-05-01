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

---

## 2. 30-second sit-to-stand (30STS)

**Literature.** Rikli & Jones 1999/2013 (Fullerton, n=7,183, ages
60–94) provide the canonical normative values: men 60–64 typically
14–19 reps, men 70–74 typically 12–17, men 80–84 typically 10–15;
women run ~1–2 reps lower per band. Below the age-band lower bound
predicts disability and loss of independence within 2 years. MCID
~2 reps in older adults; 4–6 reps represents meaningful change.
EWGSOP2 sarcopenia cutoff: 5-rep STS >15 s (a related but distinct
test). In cancer surgery (Sayer 2024, Asia-Pacific J Clin Oncol),
30STS validated against 6MWD as preoperative prognostic. In breast
cancer on anthracycline/anti-HER2 (Cantarero-Villanueva 2022, n=120),
30STS reps correlated with VO2peak (r=0.42) and 6MWD, and means were
below age-matched norms during chemotherapy. In a PDAC neoadjuvant
prehab pilot (Ausania 2024, MDPI Med Sci) 30STS was used as a primary
functional endpoint, demonstrating feasibility but no PDAC-specific
prognostic threshold yet.

**Home modality.** Standard chair (43–44 cm seat height), arms
crossed over chest, count full sit-to-stands in 30 s. Phone timer
+ tap-counter is sufficient; computer-vision pose count is feasible
but adds development cost without clear yield.

**Lead time.** STS decline tracks lower-extremity power, which falls
in chemo cohorts within 1–2 cycles of taxane exposure (paclitaxel/nab-
paclitaxel neuromuscular toxicity). In community older adults, falling
below the age-band threshold leads ECOG-equivalent functional decline
by 6–12 months; in chemotherapy this compresses to weeks.

**Sensitivity / specificity.** For predicting falls in older adults,
<8 reps gives sensitivity ~70% and specificity ~60%; not validated
in PDAC.

**n_effective = 2** (large geriatric normative base, growing oncology
use, no PDAC-specific prognostic cutoff).

**Operationalisation.** Weekly cadence; same chair, same time of day
(target morning, pre-fatigue). Caution thresholds: drop ≥3 reps from
personal 4-week rolling baseline; absolute rep count below age-band
floor (Hu Lin's age band: confirm in profile). Pair with grip strength
as a composite axis-3 detector — concordant decline in both fires at
lower threshold than either alone.

---

## 3. Gait speed (4-m and passive smartphone)

**Literature.** Studenski 2011 (JAMA, pooled n=34,485 older adults)
established gait speed as a survival predictor; <0.8 m/s = slow,
<0.6 m/s = high mortality. In oncology: Liu 2019 (Blood, n=448 older
adults with hematologic malignancies) showed 4-m gait speed
independently predicted overall survival (HR 0.10 per m/s increase),
unplanned hospitalisations, and ED visits — outperforming standard
geriatric assessments. Verweij 2021 (older colon cancer patients)
linked slow 4-m gait speed to lower likelihood of completing
adjuvant chemo. No PDAC-specific gait-speed prognostic threshold
published, but the geriatric oncology cutoff of 0.8 m/s is widely
applied. Apple's Health app exposes a "Walking Speed" metric whose
concurrent validity vs instrumented walkway is r = 0.78–0.97 in
seniors (Werner 2023, Sci Rep). Passive measurement reduces
adherence burden essentially to zero.

**Home modality.** Two layers. (a) In-clinic / at-home structured
4-m timed walk, weekly: tape two markers, phone stopwatch, walk usual
pace. (b) Passive: iOS Walking Speed (HealthKit) sampled daily,
already on the patient's phone. The two are not interchangeable —
passive is "average daily walking speed", structured is "best
sustainable usual pace" — but they trend together and either
declining is a flag.

**Lead time.** Gait speed declines weeks to months before ECOG
shifts. In Liu 2019, gait speed at baseline predicted 6-month
hospitalisation; in cachexia trajectory data, gait speed declines
roughly in parallel with grip but is more sensitive to taxane-
induced lower-limb neuropathy (relevant: nab-paclitaxel).

**Sensitivity / specificity.** For 1-year mortality at <0.8 m/s in
older oncology cohorts, sensitivity ~75%, specificity ~55%. For
<0.6 m/s the relationship inverts (high specificity, low
sensitivity — most patients aren't that slow yet).

**n_effective = 3** (replicated cancer prognostic cutoffs, large
geriatric base, no PDAC-specific cutoff).

**Operationalisation.** Weekly structured 4-m walk (mark hallway,
phone stopwatch, three trials, median). Daily passive Apple Health
Walking Speed averaged over 7-day rolling window. Caution thresholds:
structured <0.8 m/s; structured drop >0.1 m/s vs personal 4-week
baseline (above MCID of 0.05–0.10 m/s); passive 7-day average drop
>15% vs personal 28-day baseline. Treat sustained passive decline as
an axis-3 prompt to ask the patient to do the structured test.

---

## 4. Step count during chemotherapy

**Literature.** Gresham 2018 (npj Digital Medicine, n=37 advanced
cancer patients on chemo, Fitbit-Charge HR) showed daily steps
correlate with clinician-rated ECOG (r = -0.45, p<0.001), and a
~1,000-step drop predicted serious adverse events with AUROC 0.74.
Soto-Perez-de-Celis 2018 (J Geriatr Oncol) used a smartphone
pedometer in older adults starting first-line chemo and operationalised
a ≥15% drop from personal baseline as a toxicity-screen trigger,
yielding a feasible call-back protocol. Low 2024 (PROStep, JMIR,
n=108 advanced cancer on chemo) found step counts independently
predicted hospitalisation/death (HR per 1,000-step decrease 1.32,
95% CI 1.13–1.55) — additive on top of patient-reported outcomes.
Most recent (2025, JCO Clin Cancer Inform) ML models on smartphone
step data predict 7-day unplanned hospitalisation at AUROC 0.83–0.88.
No PDAC-specific cutoff but PDAC-on-GnP fits the "advanced cancer
on chemo" category these models were trained on.

**Home modality.** iPhone Health (already on patient) or Apple
Watch — both export daily step counts via HealthKit. Zero patient
burden. Watch gives sub-day granularity (sedentary block detection)
which is more sensitive than daily total.

**Lead time.** ~7 days for hospitalisation prediction in PROStep and
the JCO 2025 ML work; longer (weeks) for ECOG-aligned drift in
Gresham. Particularly sensitive on the day-2-to-day-5 post-infusion
window where neutropenia and fatigue surface.

**Sensitivity / specificity.** AUROC 0.74–0.88 for short-horizon
hospitalisation across studies; the 15% drop threshold (Soto-Perez-
de-Celis) gives an actionable but not formally validated SE/SP — used
as a call-back trigger rather than a diagnostic.

**n_effective = 3** (multiple replicated chemo cohorts, applicable
mechanism for PDAC on GnP, but no PDAC-specific threshold).

**Operationalisation.** Daily step count from HealthKit, no
patient action. Two detectors: (a) 7-day rolling average dropping
≥15% vs personal 28-day baseline (Soto-Perez-de-Celis); (b) absolute
single-day count below 1,500 steps for ≥2 consecutive days while
not in immediate post-infusion window (Gresham low-PS marker).
Cycle-aware: model the expected nadir trough at days 3–6 post-cycle
day 1 and post-cycle day 8 — flag only deviations from that
patient-specific cyclic baseline.

---

## 5. Calf circumference (CC)

**Literature.** Barbosa-Silva 2016 (J Cachexia Sarcopenia Muscle)
proposed adding CC to SARC-F (= SARC-CalF), with cutoffs <34 cm
(men), <33 cm (women) in Brazilian community-dwelling elders;
sensitivity 66.7% vs SARC-F alone 33.3%, AUC 0.74. EWGSOP-1
historical cutoff <31 cm. NHANES 1999–2006 derived cutoffs around
<34 cm (men) / <33 cm (women) generalise to US/Western populations.
In cancer specifically: Hu 2020 (Nutrition, prospective cohort
n=1,409 cancer patients) showed low CC was an independent mortality
predictor (HR ~1.5–1.8 depending on subgroup). Multiple Chinese
cancer-cachexia cohorts have replicated 33/34 cm cutoffs (Xu 2024,
Clin Nutr ESPEN — calf circumference × albumin index outperforms
either alone in older cachectic cancer patients). Specifically in
PDAC the dominant muscle-loss literature is CT-based (sarcopenia at
L3 SMI), but CC is the highest-yield home anthropometric proxy and
declines in lockstep with SMI in serial-measurement cachexia
studies.

**Home modality.** Standard non-stretch tape measure, taken at
maximum calf circumference, seated, knee at 90°. Best as guided
photo + tape number captured by phone (image is a verification
artefact, not the measurement). Burden ~30 s. Caregiver-assist
slightly improves reliability vs self-measure.

**Lead time.** CC drops weeks to months ahead of weight when
sarcopenic obesity is present (fat masks weight loss). In PDAC
where weight loss is usually overt, CC adds limb-specific
information (proximal vs distal wasting) and decline rate.
Hypothesised lead time over weight: 4–8 weeks; over ECOG: 8–16
weeks.

**Sensitivity / specificity.** SARC-CalF: sens 66.7%, spec 82.9%
for sarcopenia. Cancer-mortality prognostic value: HR 1.5–1.8 for
low CC, AUC ~0.65 alone, ~0.75 combined with albumin.

**n_effective = 3** (replicated across cachexia cohorts including
cancer-specific; PDAC analog via sarcopenia-on-CT literature).

**Operationalisation.** Weekly cadence (drift is slow, more often is
noise). Same leg, same time of day. Caution thresholds: absolute
<34 cm; trend drop ≥1 cm over 28 days; combine with albumin (already
in cycle-curves) for the calf-albumin composite. Pair with weight
(also in cycle-curves) — divergent (CC dropping while weight stable)
is the high-information case (sarcopenic muscle wasting masked by
oedema or fat retention).

---

## 6. Mid-upper arm circumference (MUAC)

**Literature.** MUAC at the midpoint between acromion and olecranon
is a long-validated proxy for upper-limb muscle + fat. In advanced
cancer: Won 2023 (Sage J Palliat Care) and Kim 2024 (Ann Palliat
Med) found MUAC ≥26.5 cm independently associated with better QOL
and predicted 12- and 24-week survival (AUROC 0.68–0.75); MUAC
specificity was high (86%) at this cutoff. MUAC and triceps
skinfold trends mirror muscle and fat compartment changes and are
practical alternatives to BIA/DXA in resource-limited or home
settings. Feasibility data exists in pediatric oncology and outpatient
adult oncology cohorts; reliability is acceptable when measured by
the same person each time (intra-rater ICC >0.9; inter-rater
~0.85). No PDAC-specific cutoff. The dominant PDAC cachexia
literature still uses CT L3 SMI; MUAC is the at-home analog.

**Home modality.** Same non-stretch tape as CC, mid-arm, dominant
arm, relaxed. Self-measure is feasible but caregiver-assisted is
more reliable. Photo + tape number capture as in CC. Burden ~30 s.

**Lead time.** MUAC is generally less sensitive than CC for early
sarcopenia (calf is more dependent on ambulation; arm is more
preserved) but more sensitive when bedridden / low-ambulation
phases dominate. As an early signal in chemo-related wasting,
hypothesised lead time over weight: 4–8 weeks.

**Sensitivity / specificity.** AUROC 0.68–0.75 for short-horizon
cancer survival; sens ~50% / spec ~86% at 26.5 cm. Combined with
albumin or grip, AUROC rises to ~0.78.

**n_effective = 2** (cancer-specific cohorts, replicated, but no
PDAC-on-GnP threshold and lower sensitivity than CC for chemo
sarcopenia).

**Operationalisation.** Bi-weekly (every 2 weeks) cadence — drift
slower than CC, weekly noisy; a once-per-cycle reading aligned to
day 1 (pre-infusion clinic) is high-fidelity. Caution thresholds:
absolute <26.5 cm; trend drop ≥0.5 cm over 28 days. Treat MUAC as
secondary to CC unless ambulation drops; if step count is sustained
low or sit-to-stand falters, MUAC weight in the composite goes up
(clinical setting where arm-wasting becomes the dominant signal).

---

## 7. Daily protein intake target

**Literature.** ESPEN 2021 (Muscaritoli et al., *Clin Nutr*):
cancer patients should consume protein >1.0 g/kg/day, target
1.2–1.5 g/kg/day, with energy 25–30 kcal/kg/day. Bauer 2019
position paper and Prado 2020 (J Cachexia Sarcopenia Muscle review)
support 1.2–1.5 g/kg/day as the floor; in active cachexia,
>1.5 g/kg combined with resistance exercise may maintain or
improve muscle. Real-world adherence is poor: 66% of advanced
cancer patients on systemic therapy fail to meet the ESPEN minimum
(Caccialanza 2023, Nutrients). For PDAC specifically, exocrine
insufficiency and chemo-induced anorexia compound the gap; PDAC-
specific dietitian guidance commonly targets 1.2–1.5 g/kg/day with
PERT to enable absorption. Boutiére 2023 (J Cachexia Sarcopenia
Muscle) reviewed whether higher protein modifies chemotherapy
response — currently no detrimental effect, possible benefit on
muscle and tolerability. The PRIMe RCT (Ford 2024, ESMO Open) in
colorectal cancer showed feasibility of 2.0 g/kg/day with ONS.

**Home modality.** 24-hour recall is the gold standard but burden-
heavy. Photo-of-plate with AI estimation (Foodvisor / Bite AI APIs)
is feasible at moderate accuracy (within ~15% of recall). Simpler:
a structured 4-quadrant self-report at end of day (animal protein
servings, dairy, plant protein, supplements) plus weekly weighing
of whey/Ensure-class supplements. The patient's weight × target
g/kg gives a daily numeric target.

**Lead time.** Protein deficit precedes muscle-mass loss by weeks.
In ESPEN-adherent cohorts (Caccialanza 2023, Bossi 2023), patients
who hit 1.2 g/kg lost less weight and lean mass at 12 weeks. As an
*input* to wasting (rather than a *measure* of it), protein intake
is one of the few modifiable axis-3 levers — its value to the
detector is in alerting on deficit *before* CC/MUAC fall.

**Sensitivity / specificity.** Not directly applicable to a
threshold; the relevant operating point is %-days-meeting-target
× 7. <50% adherence over 2 weeks → high risk of muscle loss.

**n_effective = 3** (replicated guideline recommendations, PDAC-
adjacent evidence, but the patient-specific target needs his
weight; modifiable lever rather than diagnostic).

**Operationalisation.** Daily target = body weight (kg) × 1.2 g
(floor), with stretch target × 1.5 g. Capture: photo-plate AI
estimation + manual override + supplement count. Caution
thresholds: <1.0 g/kg/day for ≥3 days in a 7-day window → yellow
zone, prompts dietitian-style nudge in feed; <0.8 g/kg/day for ≥3
days → orange. Critically pair with PERT adequacy (signal #10)
because intake without absorption is worthless in PDAC.

---

## 8. Anorexia / early satiety (FAACT A/CS)

**Literature.** The Functional Assessment of Anorexia/Cachexia
Therapy Anorexia/Cachexia Subscale (FAACT A/CS, the 12-item subscale
often referred to here as "FAACT-12") is the most validated PRO
for cancer-related anorexia. Blauwhoff-Buskermolen 2016 (Support
Care Cancer) derived an A/CS cutoff of ≤37 to define clinically
relevant anorexia (sensitivity 80%, specificity 81% vs clinician
assessment), with VAS appetite <70/100 as a faster proxy. In PDAC
specifically, anorexia and early satiety are present in ~80% of
patients with advanced disease (Fearon 2011 international consensus,
and PDAC-specific reviews Hendifar 2018, Mueller 2014). Fearon's
combined criteria — >10% weight loss + intake <1,500 kcal/day +
CRP >10 mg/L — predict reduced functional ability and worse
prognosis when ≥2 are present. The FACIT-F (fatigue scale, sister
instrument) also independently predicts PDAC mortality at median
≤30 (Lord 2008).

**Home modality.** FAACT A/CS administered weekly via app; 12 items,
~3 minutes. Daily 0–10 VAS appetite + a single early-satiety prompt
("Did you stop eating before you wanted to today because you felt
full?") — this last item is highly specific to PDAC's mass-effect
on stomach/duodenum and worth a dedicated daily nudge. Photo-of-
plate plus partial-plate logging gives an indirect intake-vs-appetite
delta.

**Lead time.** Anorexia precedes weight loss by weeks (Fearon
pre-cachexia stage). FAACT A/CS decline tracks the trajectory
into refractory cachexia. In an oncology PRO + step-count combined
model (Low 2024 PROStep), appetite/intake PROs added independent
predictive value to objective measures.

**Sensitivity / specificity.** A/CS ≤37: sens 80% / spec 81% for
clinically relevant anorexia. Fearon ≥2-of-3 criteria for
prognostic decline: AUC ~0.75.

**n_effective = 3** (PDAC-applicable, replicated PRO with cancer-
specific cutoffs; the 12-item A/CS is well validated).

**Operationalisation.** Weekly FAACT A/CS via the unified input
channel (the patient never sees a "form" — the AI parser folds
the 12 items across the week into prompted micro-questions on the
single channel). Daily 0–10 appetite + early-satiety yes/no.
Caution thresholds: A/CS ≤37 sustained ×2 weeks; daily appetite
mean <5 over 7 days; early-satiety yes on ≥4/7 days. Combine
with weight (cycle-curves) and protein-intake-target adherence
(signal 7) to fire the Fearon-style composite.

---

## 9. Phase angle (PhA) from bioelectrical impedance analysis

**Literature.** Gupta 2004 (Br J Nutr, n=58 stage IV PDAC at CTCA)
is the foundational PDAC-specific study: PhA <5.0° gave median
survival 6.3 months vs >5.0° gave 10.2 months (p=0.02), independent
of stage and KPS. Subsequent work has replicated in colorectal
(Gupta 2004 cutoff 5.6°), breast, lung, and head-and-neck
chemoradiotherapy populations (Lukaski 2017 review). In ambulatory
palliative oncology (Hui 2017), mean PhA ~4.4°. Norman 2022
(systematic review, Rev Endocr Metab Disord) consolidates PhA as a
robust prognostic biomarker across cancer types, with
hydration-state being the major confounder; multi-frequency BIA
(MF-BIA) reduces this. PhA reflects cell-membrane integrity and
intracellular/extracellular water ratio — sensitive to muscle
quality, not just mass. In PDAC specifically the 5° cutoff has
been replicated multiple times and is the most reliable single-
number BIA marker.

**Home modality.** Consumer BIA scales are unreliable for PhA at
the precision required (need MF-BIA or InBody-class device,
$200–800). Outpatient feasibility is good if the patient owns one:
2-min standing measurement, fasted, post-void, similar hydration
each session. Without a home BIA device this signal is hardware-
blocked at v2 and requires either purchase or in-clinic capture
at infusion visits.

**Lead time.** PhA decline tracks cellular wasting before overt
muscle-mass loss. In head-and-neck chemoradiotherapy (Pereira 2016)
PhA decline at 4 weeks predicted full-blown cachexia at 12 weeks.
In PDAC the original Gupta study tied baseline PhA to survival but
did not test serial measurements. Hypothesised lead time over
ECOG: 8–16 weeks; over CC: 4–6 weeks.

**Sensitivity / specificity.** For predicting 6-month mortality in
advanced PDAC at PhA <5°: sens ~70%, spec ~65% (Gupta 2004
post-hoc). Combined with albumin (already in cycle-curves) and CC
the predictive combination performs better than any single marker.

**n_effective = 3** (PDAC-specific, replicated cutoff, but
hardware-blocked for home capture and confounded by hydration).

**Operationalisation.** If home InBody / MF-BIA available: weekly
fasted standing reading at consistent time. Caution thresholds:
absolute PhA <5.0°; trend drop ≥0.3° over 28 days. If hardware
unavailable, capture in-clinic on infusion days (cycle day 1) and
note in feed only — do not rely on it as a frequent detector.
Cross-check against hydration (recent diuretics, oedema) before
firing zone changes.

---

## 10. Stool frequency / Bristol / PERT adequacy

**Literature.** Pancreatic exocrine insufficiency (PEI) is present
in 60–90% of PDAC patients depending on tumor location (Sikkens
2014, Roeyen 2022 expert opinion). The Bristol Stool Form Scale is
the standard description tool (types 5–7 = loose/watery; 6–7 with
oily/floating qualities suggests steatorrhea). Differentiation
between PEI and chemotherapy-induced diarrhea (CID) matters because
the mechanisms and management diverge: PEI = pale, bulky, oily,
malodorous, floating, often after fatty meals, responsive to
PERT (Creon) titration; CID (gemcitabine and 5-FU more than
nab-paclitaxel) tends to be watery, secretory, time-locked to
infusion days, responsive to loperamide. Chemotherapy itself rarely
causes new exocrine insufficiency. Steatorrhea requires <10% of
normal lipase secretion; the 72-h fecal fat test is the gold
standard but never feasible at home. PERT adequacy is judged
clinically: stool form normalising toward Bristol 4, reduced
flatulence, weight stabilising, and protein/fat absorption (proxy:
albumin trend, weight stability). Roeyen 2022 expert opinion gives
starting Creon dose 50,000–75,000 PhU per main meal, 25,000 PhU
per snack, titrated upward.

**Home modality.** Single daily prompt on the unified channel:
"How many bowel motions today? Bristol type? Any oily / floating?"
Phone-photo of stool is technically possible but a privacy/burden
issue — descriptor + Bristol-icon tap is sufficient. Daily PERT
dose log alongside meals. Burden ~15 s/day.

**Lead time.** PEI undertreated is a slow leak — drives weight loss
and protein malabsorption over weeks and is often missed because it
masquerades as "normal cancer fatigue". Identifying inadequate PERT
is high-leverage: a Creon up-titration can reverse the trajectory
within 1–2 weeks. Detecting CID inside the post-infusion window
(days 2–5) is short-horizon and triggers loperamide + hydration
nudges and oncology-call thresholds.

**Sensitivity / specificity.** No formal SE/SP for the home Bristol
+ symptom panel. Clinical experience: any patient with PDAC head
tumor + Bristol ≥5 + oily/floating descriptor on ≥3 days/week is
almost certainly PEI under-treated.

**n_effective = 3** (PDAC-applicable, replicated expert
recommendations, no precise quantitative threshold).

**Operationalisation.** Daily one-tap stool diary: count, Bristol
type, oily/floating yes/no. PERT dose logged with each meal/snack.
Two distinct detectors: (a) PEI-undertreated — Bristol ≥5 with
oily/floating ≥3 days/week → orange feed item recommending PERT
review; (b) CID — Bristol 6–7, watery, time-locked to days 2–5
post-infusion, count >4/day → CTCAE grade ≥2 diarrhea handler
(loperamide + hydration nudge, escalate to oncology if persistent).
Weight loss + persistent Bristol ≥5 + low albumin = the high-
information PEI composite.

---

## 11. Resting heart rate (RHR)

**Literature.** Anker 2016 (Eur J Heart Fail, prospective long-term
cardiovascular study) showed RHR is an independent mortality
predictor specifically in colorectal, pancreatic, and non-small
cell lung cancer; HR per 10 bpm increase ~1.2–1.4. Anker 2020
(Eur J Heart Fail, treatment-naïve unselected cancer cohort, n=900+)
replicated: each 10 bpm increase associated with HR ~1.34 for 1-year
mortality. The mechanism is sympathetic activation driven by
tumor-derived inflammatory cytokines and metabolic stress, and it
precedes overt cachexia and weight loss (Lena 2023, JACC: cardiac
wasting study showed stroke volume decreased and RHR increased
over time as cachexia progressed). Sinus tachycardia in cancer is
under-recognised (Frontiers Oncol Reviews 2024). Wakefield 2025
(JCO Clin Cancer Inform, n=213 on chemo, Fitbit) found activity
fragmentation and peak cadence predicted mortality; RHR was part
of the wearable signal stack. Hu Lin's pancreatic cancer is
specifically named in Anker 2016 — relevant.

**Home modality.** Apple Watch / Fitbit / Oura — passive RHR
measurement is mature, validated against ECG within ~3 bpm in
seniors (npj Digital Medicine 2025 living meta-analysis on Apple
Watch accuracy). Zero patient burden once on-wrist. Apple's
HealthKit "RestingHeartRate" is a 7-day rolling estimate that
already filters noise.

**Lead time.** RHR rise can lead overt cachexia signs by weeks to
months (Lena 2023). In acute illness or sepsis it leads measurable
PS decline by 24–72 h. Treat as an early "something is shifting"
beacon, not a specific signal.

**Sensitivity / specificity.** No single threshold; the operating
characteristic is the trend. RHR sustained >85 bpm in a previously
~65-bpm patient is high-information; >100 bpm sustained = warning.
HR per 10 bpm 1.2–1.4 across studies.

**n_effective = 3** (PDAC-included replicated cohorts, mature
wearable capture, but threshold is patient-relative).

**Operationalisation.** Daily passive RHR from HealthKit. Caution
thresholds: 7-day rolling RHR rises ≥10 bpm above personal 28-day
baseline (sustained ≥3 days); absolute RHR >90 bpm sustained 3 days.
Pair with infection-screen prompts (fever, post-infusion neutropenia
window) — RHR rise + low ANC predicted day → high-priority feed
item to trigger oncology contact.

---

## 12. Heart rate variability (HRV)

**Literature.** HRV is a vagal-tone proxy with extensive cancer
prognostic literature. De Couck 2013 (n=651 mixed cancers) found
SDNN <70 ms gave HR 1.9 (1.4–2.5) for mortality, independent of
age/stage/PS. Mouton 2012 (Auton Neurosci) showed SDNN <20 ms in
colorectal cancer predicted higher CEA at 12 months. Most
relevantly: Mouton/De Couck 2016 (Auton Neurosci) showed in
*metastatic pancreatic cancer* specifically that higher baseline
HRV (>20 ms) doubled median overall survival (133.5 vs 64.0 days),
and the effect was inflammation-mediated. The PMC10541060
(Hozawa-Tarumi 2023, "Assessment of HRV in Pancreatic Cancer")
median survival 9 vs 15 months by SDNN tertile. van der Schans
2023 (Sage Open Med) case report demonstrated consumer wearable
HRV (Garmin) tracked treatment-related autonomic stress and
recovery in PDAC. Caveat: short-term HRV (5-min ECG, lab) and
overnight HRV (wearable) are different measurements; reproducibility
of consumer-watch HRV is moderate.

**Home modality.** Apple Watch overnight HRV (SDNN, 1-min sampling
during sleep), Oura ring (RMSSD overnight), or Garmin (multiple
metrics). Zero patient burden once on-wrist/ring. RMSSD is
generally preferred for parasympathetic-tone tracking; SDNN for
overall variability. Apple Health exposes these via HealthKit.

**Lead time.** HRV decline tracks autonomic stress and inflammation;
in chemotherapy recovery cycles HRV dips with each infusion and
returns. A failure-to-recover pattern (HRV not rebounding by day
14 post-cycle) is a hypothesised early signal for cumulative
toxicity or progression. Lead time over ECOG: 4–8 weeks.

**Sensitivity / specificity.** SDNN <70 ms HR 1.9; SDNN <20 ms
predictive at 12 months. No formal SE/SP for serial home capture.

**n_effective = 3** (PDAC-specific evidence including metastatic;
consumer wearables capture adequately though noisily).

**Operationalisation.** Daily overnight HRV (RMSSD or SDNN) from
HealthKit. Caution thresholds: 7-day rolling RMSSD drop ≥20% vs
personal 28-day baseline; failure to recover to baseline by day
10 post-infusion. Combine with RHR (signal 11) — divergent (RHR
high + HRV low) is the classic sympathetic-dominant cachectic
state and the highest-information composite. Treat absolute SDNN
<70 ms or RMSSD <20 ms as a sustained-yellow trigger to prompt
clinic-visit prep.

---

## 13. Sleep fragmentation

**Literature.** Cancer patients have markedly fragmented sleep:
~30–50% prevalence of clinically significant sleep disturbance in
advanced cancer (Mercadante 2022 review). Pasternak 2023
(Cancers, exploratory ML study, n=78 advanced cancer with
actigraphy + clinical data) found wake-after-sleep-onset (WASO)
and sleep efficiency added independent prognostic value to
clinician-estimated survival, hemoglobin, and global health.
Innominato 2018 (Sleep Med) showed sleep duration in advanced
cancer correlates with survival. Pre-clinical: methotrexate
fragments NREM sleep persistently in mice (Sleep 2025) — direct
chemo-toxicity effect on sleep architecture, biologically plausible
for nab-paclitaxel by analog. Sleep disruption is bidirectionally
linked with cachexia: inflammatory cytokines drive both sleep
fragmentation and muscle catabolism (Let's Win PC commentary on
sleep–cachexia mechanisms, 2024). Sleep fragmentation precedes
overt fatigue scores in many actigraphy-fatigue cohorts (Ancoli-
Israel 2014 in breast cancer chemotherapy).

**Home modality.** Apple Watch overnight sleep stage tracking,
Oura ring, Fitbit, Whoop — all expose sleep efficiency, WASO,
total sleep time, awakenings count. Validity vs polysomnography
is moderate (Apple Watch: ~80% epoch agreement vs PSG; better
for total sleep time than for staging). For detection of
*fragmentation trends* (the relevant signal here), wearables are
fit for purpose.

**Lead time.** Sleep fragmentation can lead fatigue PRO scores by
1–2 weeks in chemotherapy cohorts. As an autonomic / inflammatory
proxy it tracks similar timescale to HRV. Lead time over ECOG:
estimated 4–8 weeks, exploratory.

**Sensitivity / specificity.** Not formally validated for axis-3
detection. WASO and sleep efficiency are continuous predictors;
no cancer-specific cutpoints.

**n_effective = 2** (chemo cohorts replicate the pattern, advanced
cancer prognostic value, but not PDAC-specific and consumer
wearable validity is moderate).

**Operationalisation.** Daily passive sleep metrics from HealthKit
(Apple Watch). Track: sleep efficiency, WASO minutes, awakenings
count, total sleep time. Caution thresholds: 7-day rolling sleep
efficiency drop ≥10% vs personal 28-day baseline; WASO sustained
>60 min/night for 4+ nights. Combine with HRV (signal 12) and
fatigue PRO (cycle-curves) — sleep fragmentation + falling HRV
+ rising fatigue is a strong axis-3 composite. Sleep fragmentation
alone is a soft signal; in combination it is a leading edge.

---

## Summary — what to add to v2 detectors

**Top 5 highest-leverage signals to wire up first:**

1. **Step count (signal 4)** — already on the patient's iPhone via
   HealthKit, zero burden, AUROC 0.83–0.88 for short-horizon
   hospitalisation in chemo cohorts, replicated 15%-drop trigger
   from Soto-Perez-de-Celis. This is the single highest-leverage
   wearable signal because it is free, passive, and has the
   strongest published cancer-on-chemo evidence base.
2. **Resting heart rate (signal 11)** — passive HealthKit, PDAC-
   specific mortality data (Anker 2016), and an early sympathetic-
   activation signal that precedes overt cachexia. Combined with
   ANC nadir prediction it functions as an infection screen.
3. **Daily protein intake target (signal 7)** — modifiable lever
   (not just a sensor), 1.2–1.5 g/kg/day, addressable via the same
   single-channel input. Hits the "what to do about it" half of
   axis-3 in a way that the other signals don't.
4. **Stool / Bristol / PERT adequacy (signal 10)** — PDAC-specific,
   high-leverage because under-treated PEI is reversible with
   Creon titration within 1–2 weeks; differentiation from chemo-
   diarrhea changes the action ladder.
5. **Grip strength (signal 1)** — replicated PDAC-specific
   prognostic data (Freckelton 2024 HR 1.88), Bluetooth dynamometer
   ~$30, twice-daily AM/PM gives both static peak and an
   exploratory fatigability ratio.

**Already covered by existing cycle-curves (do not duplicate):**

- Weight → cycle-curves; CC and MUAC complement it but the
  weight curve already exists.
- Albumin → cycle-curves; pairs with CC for the Calf-Albumin
  composite from Xu 2024.
- Fatigue PRO → cycle-curves; FAACT A/CS (signal 8) extends to
  appetite/anorexia which is distinct.
- Neuropathy → cycle-curves; grip fatigability (signal 1) and STS
  (signal 2) can detect motor consequences earlier than the PRO.

**Hardware-blocked at v2 (defer or capture in clinic only):**

- Phase angle from BIA (signal 9) — needs MF-BIA / InBody-class
  hardware. If patient acquires one, wire up; otherwise capture at
  infusion visits.
- HRV (signal 12) — strong evidence including PDAC-specific, but
  requires Apple Watch / Oura / Whoop on-wrist consistently. Soft-
  block: enable if hardware present.
- Sleep fragmentation (signal 13) — same hardware dependency as
  HRV. If wearable present, both come essentially free.

**Mid-tier (wire up but expect modest yield):**

- Sit-to-stand (signal 2) — useful as a grip-strength composite
  cross-check, weekly cadence.
- Gait speed (signal 3) — passive Apple Health "Walking Speed" is
  free; structured 4-m walk is weekly.
- Calf circumference (signal 5) — weekly tape measure, small
  burden, complements weight + albumin.
- MUAC (signal 6) — bi-weekly, lower priority than CC unless
  ambulation drops.
- Anorexia / FAACT A/CS (signal 8) — high-yield PRO but the
  unified-channel design needs to fold the 12-item subscale into
  conversational input rather than a form.

**Composite detectors to build first (do not ship single-signal
detectors when a composite is available in literature):**

- Falling step count + rising RHR + falling HRV → "autonomic /
  activity drift" → orange feed item, prompts clinic prep.
- Bristol ≥5 + oily/floating + falling weight + falling albumin →
  "PEI under-treated" → orange feed item, prompts PERT review.
- Falling grip + falling STS reps + falling CC → "sarcopenic
  drift" → yellow feed item, prompts protein-intake nudge and
  caregiver-assist measurement check.
- Falling appetite + protein-intake gap + falling weight + early
  satiety yes → Fearon-style cachexia composite → orange feed
  item, prompts dietitian referral.

The framework's `n_effective` Bayesian prior weighting should
reflect the per-signal evidence quality (mostly 2–3 in this list);
the highest-confidence priors are step count, RHR, grip, and PERT-
related stool signals.

---

## Citations (flat list)

- Anker MS et al. Resting heart rate is an independent predictor
  of death in patients with colorectal, pancreatic, and non-small
  cell lung cancer. Eur J Heart Fail. 2016.
- Anker MS et al. Increased resting heart rate and prognosis in
  treatment-naïve unselected cancer patients. Eur J Heart Fail.
  2020.
- Ancoli-Israel S et al. Fatigue, sleep, and circadian rhythms in
  breast cancer chemotherapy. (multiple papers, 2006–2014).
- Ausania F et al. Supervised home-based exercise prehabilitation
  in pancreatic cancer patients undergoing neoadjuvant
  chemotherapy: a pilot feasibility study. Med Sci (Basel) 2024.
- Barbosa-Silva TG et al. Enhancing SARC-F: improving sarcopenia
  screening in the clinical practice. J Am Med Dir Assoc. 2016
  (SARC-CalF cutoffs <34 cm men / <33 cm women).
- Bauer J et al. Evidence-based recommendations for optimal dietary
  protein intake in older people: a position paper. JAMDA 2013;
  Bauer 2019 update for cancer cachexia.
- Blauwhoff-Buskermolen S et al. The assessment of anorexia in
  patients with cancer: cut-off values for the FAACT–A/CS and the
  VAS for appetite. Support Care Cancer. 2016.
- Boutiére C et al. Protein intake in cancer: does it improve
  nutritional status and/or modify tumour response to
  chemotherapy? J Cachexia Sarcopenia Muscle. 2023.
- Caccialanza R et al. High-protein oral nutritional supplements
  enable the majority of cancer patients to meet ESPEN protein
  recommendations. Nutrients 2023.
- Cantarero-Villanueva I et al. Thirty-second sit-to-stand test as
  an alternative for estimating peak oxygen uptake and 6-min
  walking distance in women with breast cancer. Support Care
  Cancer 2022.
- De Couck M et al. Heart rate variability and cancer survival
  (multiple papers including Auton Neurosci 2013 and 2016 PDAC-
  specific work with Mouton).
- Fearon K et al. Definition and classification of cancer cachexia:
  an international consensus. Lancet Oncol. 2011.
- Ford KL et al. Feasibility of two levels of protein intake in
  patients with colorectal cancer: PRIMe RCT. ESMO Open 2024.
- Freckelton J et al. Handgrip Strength Predicts Survival in
  Patients With Pancreatic Cancer. Pancreas / J Cachexia 2024
  (HR 1.88, 95% CI 1.15–3.09).
- Gresham G et al. Wearable activity monitors to assess
  performance status and predict clinical outcomes in advanced
  cancer patients. npj Digital Medicine 2018.
- Gupta D et al. Bioelectrical impedance phase angle as a
  prognostic indicator in advanced pancreatic cancer. Br J Nutr.
  2004 (PhA <5° threshold).
- Hendifar AE et al. Pancreatic adenocarcinoma cachexia (review
  and prognostic data). 2018.
- Hozawa-Tarumi et al. The Assessment of Heart Rate Variability in
  Patients With Pancreatic Cancer. PMC10541060, 2023.
- Hu CL et al. Low calf circumference is an independent predictor
  of mortality in cancer patients: a prospective cohort study.
  Nutrition 2020.
- Innominato PF et al. Sleep duration is associated with survival
  in advanced cancer patients. Sleep Med 2018.
- Jäkel B et al. Hand grip strength and fatigability: correlation
  with clinical parameters and diagnostic suitability in ME/CFS.
  J Transl Med 2021 (Fmax/Fmean and Recovery Ratio protocol).
- Kim YJ et al. Performance of mid-upper arm circumference and
  other prognostic indices based on inflammation and nutrition in
  oncology outpatients. Ann Palliat Med 2024.
- Lena A et al. Clinical and prognostic relevance of cardiac
  wasting in patients with advanced cancer. JACC 2023.
- Liu MA et al. Gait speed, grip strength, and clinical outcomes
  in older patients with hematologic malignancies. Blood 2019.
- Low CA et al. PROStep: secondary analysis of PROs and step
  counts predicting hospitalisation/death in advanced cancer on
  chemo. JMIR / J Clin Oncol 2024.
- Lukaski HC et al. Phase angle as a marker of nutritional status
  in cancer (review). 2017.
- Mercadante S et al. Sleep disturbances in advanced cancer
  (review). 2022.
- Mouton C et al. The relationship between heart rate variability
  and time-course of carcinoembryonic antigen in colorectal cancer.
  Auton Neurosci 2012; subsequent PDAC-specific work De Couck/
  Mouton 2016 Auton Neurosci.
- Mueller TC et al. Cachexia and pancreatic cancer (mechanisms
  review). 2014.
- Murray L et al. Fat malabsorption in pancreatic cancer:
  pathophysiology and management. Nutr Clin Pract 2024.
- Norman K et al. Diagnostic and prognostic utility of phase
  angle in patients with cancer. Rev Endocr Metab Disord 2022.
- Ordan MA et al. FIGHTDIGO study: feasibility of systematic
  handgrip strength testing in digestive cancer patients. Cancer
  2018; FIGHTDIGOTOX cohort 2022 (Bourdel-Marchasson) for
  toxicity prediction at <34 kg / <22 kg cutoffs.
- Pasternak J et al. Prognostication in advanced cancer by
  combining actigraphy-derived rest-activity and sleep parameters
  with routine clinical data. Cancers 2023.
- Pereira MME et al. Bioelectrical impedance phase angle as
  indicator and predictor of cachexia in head and neck cancer
  patients treated with (chemo)radiotherapy. Eur J Clin Nutr 2016.
- Prado CM et al. Nutrition interventions to treat low muscle mass
  in cancer. J Cachexia Sarcopenia Muscle 2020.
- Rikli RE, Jones CJ. Functional fitness normative scores for
  community-residing older adults, ages 60–94. J Aging Phys Act
  1999; updated thresholds 2013.
- Roeyen G et al. Expert opinion on management of pancreatic
  exocrine insufficiency in pancreatic cancer. PMC8819032, 2022.
- Sayer C et al. 30-s STS validated as preoperative cancer-surgery
  prognostic. Asia-Pac J Clin Oncol 2024.
- Sikkens ECM et al. Pancreatic exocrine insufficiency in chronic
  pancreatitis and pancreatic cancer. (review). 2014.
- Soto-Perez-de-Celis E et al. A pilot study of an accelerometer-
  equipped smartphone to monitor older adults with cancer
  receiving chemotherapy in Mexico. J Geriatr Oncol 2018.
- Studenski S et al. Gait speed and survival in older adults.
  JAMA 2011.
- van der Schans CP et al. Monitoring physical impact and recovery
  of pancreatic cancer treatment using consumer wearable health
  data: a case report. Sage Open Med 2023.
- Verweij NM et al. 4-meter gait speed and adjuvant chemotherapy
  delivery in older colon cancer patients. 2021.
- Wakefield C et al. Machine learning–based prediction of clinical
  outcomes in cancer using smartphone step count data. JCO Clin
  Cancer Inform 2025.
- Werner C et al. Validity and reliability of a smartphone
  application for home measurement of 4-m gait speed in older
  adults. Bioengineering 2024; Apple Health gait validity Sci
  Rep 2023.
- Won SH et al. Mid-upper arm circumference as an indicator of
  quality of life of patients with advanced cancer. J Palliat
  Care 2023.
- Xu H et al. Calf circumference-albumin index in older patients
  with cancer cachexia. Clin Nutr ESPEN 2024.



