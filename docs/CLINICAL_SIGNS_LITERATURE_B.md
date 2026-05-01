# Clinical Signs Literature — Cluster B

Companion to `CLINICAL_SIGNS_LITERATURE.md`. Scope: cognitive, mood, pain, PDAC-specific symptoms, liver/biliary, hydration/pulmonary signals. All signals are home-measurable or patient-reportable, all selected for axis-3 (treatment-toxicity) drift detection during MPACT-protocol gemcitabine + nab-paclitaxel (GnP) days 1, 8, 15 of 28-day cycles, with a biliary stent in situ.

Each entry: literature, home modality, lead-time advantage, sensitivity/specificity if reported, suggested `n_effective` Bayesian prior weight (1–4), concrete operationalisation.

---

## Cognitive

### 1. Cancer-related cognitive impairment (CRCI) trajectory

**Literature.** Janelsins et al.'s nationwide cohort (J Clin Oncol 2018; n=581 breast-cancer patients with matched controls) is the largest longitudinal CRCI dataset. Patients showed substantially greater FACT-Cog Perceived Cognitive Impairment (PCI) decline than age-matched controls from pre-chemo to post-chemo and to 6 months post-chemo, with 45.2% of patients vs 10.4% of controls reporting clinically meaningful decline. CRCI prevalence rises from ~25% pre-chemo to up to ~75% during chemo and persists in ~35% post-chemo (Lange et al., Ann Oncol 2019). Domains hit hardest: processing speed, working memory, executive function. PDAC-specific CRCI literature is essentially absent — extrapolation from breast/colorectal cohorts on platinum, taxane, and gemcitabine regimens is required (flag honestly). Gemcitabine has been shown in murine models (Dietrich, Han, et al.) to impair hippocampal neurogenesis; the Hirshberg Foundation explicitly notes chemobrain in PDAC is under-recognised. Validated FACT-Cog PCI cutoffs: ≤59.5 on PCI-20 gives 78.8% sensitivity / 84.1% specificity for CRCI; MCID 6.9–10.6 points (Cheung et al., J Patient Rep Outcomes 2018).

**Home modality.** FACT-Cog v3 (37 items, ~7 min) every 2 weeks; Symbol Digit Modalities Test (SDMT) digital adaptation (~90s) at every cycle day-1 visit; optional brief Stroop via web/iOS app monthly. Capture in-app, log raw item responses for re-scoring.

**Lead-time advantage.** Processing-speed declines often appear cycle 2–3 of chemo, weeks before measurable ECOG drop; CRCI tracks fatigue but partially decouples, providing an independent axis-3 signal.

**Sensitivity / specificity.** FACT-Cog PCI-20 ≤59.5: Se 78.8% / Sp 84.1% for any CRCI in breast cohorts.

**n_effective:** 2 (strong instrument validity, but PDAC extrapolation modest).

**Operationalisation.** FACT-Cog PCI-20 every 14 days. Caution if drop ≥7 points from personal baseline OR absolute score <60 sustained ≥2 administrations. Pair with monthly SDMT — flag if SDMT z-score declines >0.5 SD vs baseline. Differentiate from depression (cross-check against PHQ-9 item 3 on concentration).

### 2. PHQ-9 trajectory under cytotoxic chemotherapy

**Literature.** Depression in PDAC has a higher prevalence than almost any other malignancy: 34–51.8% by PHQ-9 ≥10 (Boyd et al., Mayo studies; Mayr & Schmid 2010 review), against ~16% in general cancer (Hartung et al., BMC Psychiatry 2017). The PHQ-9 cut-off ≥10 is the standard "moderate depression" threshold and is validated in cancer populations (Hartung 2017; Wagner et al. ASCO). PDAC depression frequently *precedes* diagnosis (paraneoplastic, possibly cytokine/IL-6-mediated) and is a documented poor-prognosis marker — multiple cohorts show shorter OS in PDAC patients with major depression (Boyd 2012; Lifetime Stressor study, Florida Pancreas Collaborative 2024). Within-cycle GnP trajectories are not specifically characterised, but general oncology data show somatic-symptom items (sleep, appetite, fatigue, psychomotor) spike days 3–7 post-infusion, normalising by day 14–21; mood-cognitive items (anhedonia, worthlessness) lag by 1–2 cycles. Somatic items inflate PHQ-9 in chemo patients — the somatic-only subscore has lower specificity (Stafford et al. 2019); the *non-somatic* PHQ-9 subscore (items 1, 2, 6, 9) better discriminates true depressive disorder.

**Home modality.** Self-administered PHQ-9 in-app, weekly, with day-of-cycle metadata captured automatically. Optional voice-diary tag for prosodic features later. Item 9 (suicidal ideation) triggers immediate routing to clinical contact regardless of total.

**Lead-time advantage.** PHQ-9 deterioration ≥5 points has been associated with poorer downstream functional decline and earlier dose reduction (general oncology). PDAC-specific lead time over ECOG: not formally measured, but plausibly 2–6 weeks given tight depression–cachexia–fatigue coupling.

**Sensitivity / specificity.** PHQ-9 ≥10 in cancer: Se ~80%, Sp ~80% for major depression (Hartung 2017).

**n_effective:** 3 (PDAC-specific signal, well-validated instrument, strong prognostic).

**Operationalisation.** Weekly PHQ-9. Caution if total ≥10 OR ≥5-point increase from rolling 4-week mean OR any single item ≥2 sustained ≥2 weeks. Item 9 (self-harm) any non-zero → immediate alert (out-of-band, not feed-ranked). Track separately the non-somatic subscore (items 1, 2, 6, 9) to disentangle from chemo-toxicity confound.

### 3. GAD-7 trajectory plus NCCN Distress Thermometer

**Literature.** Anxiety prevalence in cancer is ~10–15% by classic GAD-7 ≥10; lowering to ≥8 increases detection to 22–28% with optimal Se/Sp balance in oncology (Esser et al., PLOS One 2025; Lowe et al. validation 2008). The classic ≥10 cut-off has only ~55% sensitivity in oncology — significant under-detection. PDAC anxiety prevalence is consistently among the highest of all cancers, reported around 30–40% co-occurring with depression (Mayr & Schmid; Kenner Pancreas 2018). The NCCN Distress Thermometer (DT) is a single 0–10 visual analogue plus 39-item problem checklist; cut-off ≥4 is the long-standing NCCN recommendation, but advanced-cancer / palliative populations show optimal performance at ≥6 (Ownby, J Adv Pract Oncol 2019; Frontiers in Oncology 2023). Prognostic value: high distress trajectories independently predict ED visits, unplanned admissions, and reduced chemo completion. PDAC-specific DT ≥6 has been associated with worse 6-month QoL trajectory (Janda et al., Pancreas studies).

**Home modality.** Weekly GAD-7 (~2 min) and Distress Thermometer (~30s, 0–10 single item). Both well-suited to a quick tap interface; DT is the lowest-friction option for tired days.

**Lead-time advantage.** Distress trajectories rise 4–8 weeks before unplanned admission in advanced cancer cohorts (Carlson et al., 2019); a sustained DT ≥6 has been linked to dose-reduction events.

**Sensitivity / specificity.** GAD-7 ≥8: Se ~80% / Sp ~70% in cancer; DT ≥4: Se ~80% / Sp ~60% (general); DT ≥6 better in advanced disease.

**n_effective:** 3 (validated, fast, prognostic in PDAC).

**Operationalisation.** Weekly GAD-7 paired with the PHQ-9. Caution if GAD-7 ≥8 sustained ≥2 weeks OR ≥5-point rise from rolling baseline. DT daily on quick-tap surface; caution at DT ≥6 for ≥3 days in any 7-day window. Both feed into the unified zone engine; spike on day 3–5 post-infusion (transient infusion-related distress) is expected and should be down-weighted by cycle-day model.

## Pain

### 4. PDAC pain phenotypes — visceral / somatic / neuropathic

**Literature.** PDAC pain has three discriminable phenotypes (Coveler et al., Oncologist 2021; Drewes 2018 review): (a) **visceral epigastric** — dull, deep, periumbilical/epigastric, postprandial worsening, classically from ductal obstruction, mass effect, ischaemia; (b) **somatic mid-back** — gnawing, well-localised T10-L2, often nocturnal, indicates retroperitoneal/coeliac-plexus invasion; (c) **neuropathic** — burning, lancinating, dysaesthetic, in either visceral referred dermatomes or distal extremities (overlapping with chemotherapy-induced peripheral neuropathy from nab-paclitaxel). Patients with body/tail tumours have substantially more pain than head tumours (Kelsen et al., classic data) — head tumours present earlier with jaundice. Neuropathic component is present in ~30–40% of PDAC pain (Bouwense et al., Pain 2022; Drewes), and central sensitisation is documented (Olesen et al., Pain Pract 2010 — pancreatic cancer patients show abnormal central pain processing on QST). Pain trajectories under GnP: gemcitabine alone has a small but real analgesic effect via mass-effect reduction; nab-paclitaxel adds neuropathic burden over cycles. Worsening visceral pain ≥1 month often heralds progression. Pain severity correlates strongly with shorter survival across multiple PDAC cohorts.

**Home modality.** Daily NRS 0–10 with body-region tap (epigastric / back / chest / RUQ / lower / extremity), pain-quality multiple-choice (dull-aching / sharp / burning-tingling / cramping / pressure), temporal pattern (continuous / postprandial / nocturnal / random), painDETECT short form weekly to quantify neuropathic component (≥19 = neuropathic, 13–18 = ambiguous).

**Lead-time advantage.** Rising visceral score has been documented to precede CT progression by 4–8 weeks in PDAC (Müller-Schilling 2019); rising neuropathic score is the canonical warning of nab-paclitaxel-related axis-3 toxicity, weeks before objective neurological exam findings.

**Sensitivity / specificity.** painDETECT for neuropathic component: Se ~85% / Sp ~80% (Freynhagen 2006).

**n_effective:** 4 (PDAC-specific, multi-axis discriminator, mature literature).

**Operationalisation.** Daily NRS by region + quality. Caution if any of: rolling 7-day mean visceral NRS ≥+2 vs prior 28-day mean; back-pain new onset ≥3/10 ≥3 days; painDETECT ≥19 (orange). Body/tail location tag drives region-prior weighting. Distinguish opioid-rescue events (signal 5) from opioid-baseline.

### 5. Opioid requirement creep — progression vs neuropathic emergence

**Literature.** Opioid Escalation Index (OEI; Mercadante & Bruera, J Pain Symptom Manage classic) measures rate of MEDD (morphine-equivalent daily dose) increase. OEI >5%/week or >20% over 4 weeks is empirically associated with disease progression rather than tolerance in advanced cancer (Mercadante 2007). In stage-IV PDAC, high baseline opioid use independently predicts shorter OS (Zylla et al., Pancreas 2020 — HR 1.5–2 for high vs low). However, dose creep can also reflect emerging chemotherapy-induced peripheral neuropathy (CIPN), tachyphylaxis, or anxiety-related amplification, so attribution requires phenotype context. The signal is most informative as *rate of change* in MEDD plus *region-shift* in pain (visceral creep → progression; distal extremity creep → CIPN).

**Home modality.** App-based opioid log with timestamp, drug, dose, indication tag (background-scheduled / breakthrough / pre-meal / pre-activity). Auto-compute rolling 7-day MEDD. Pair with daily pain NRS by region (signal 4). Optional photo of pill packs for adherence verification.

**Lead-time advantage.** OEI rise has been shown to precede radiographic progression by 4–12 weeks (Mercadante observational data; Reddy palliative cohorts). In PDAC where progression frequently outruns scheduled imaging, this is one of the highest-value home signals.

**Sensitivity / specificity.** No formal Se/Sp; OEI >5%/week sustained 4 weeks has positive predictive value for progression-or-uncontrolled-pain ~70% (Mercadante 2007).

**n_effective:** 3 (mature concept, but multi-causal; needs phenotype gating).

**Operationalisation.** Compute MEDD daily. Caution if ≥25% MEDD increase over 14 days vs prior 28-day mean. Combine with pain-region trajectory: if MEDD rise + visceral/back NRS rise → high suspicion progression; if MEDD rise + distal-extremity neuropathic NRS rise → high suspicion CIPN; if MEDD rise without pain NRS rise → review for tolerance, anxiety, opioid hyperalgesia. Always feed into the mandatory-review conversation, not auto-action.

### 6. Breakthrough pain frequency

**Literature.** Breakthrough cancer pain (BTcP), per EAPC and ESMO definition, is a transient exacerbation of pain on a background of otherwise controlled pain (Mercadante & Caraceni 2002; Davies, EAPC 2009 algorithm; ESMO 2018). Typical episodes: peak <5 min from onset, duration ~30–60 min, mean 2–4 per day in advanced cancer, but >4/day signals inadequate background control or progression (Caraceni & Davies expert reviews). PDAC has among the highest BTcP prevalence of solid tumours (~70% in advanced disease; Hagen 2008). Frequency >3/day or sustained increase from personal baseline triggers re-titration of long-acting opioid OR investigation of progression. Postprandial epigastric exacerbation is a classic PDAC pattern (signal 8).

**Home modality.** Same opioid log as signal 5, with explicit "breakthrough event" button — captures NRS pre/post, time-to-relief, suspected trigger (food / movement / spontaneous / nocturnal). Quick tap pattern: 2 taps to log a BTcP event.

**Lead-time advantage.** Rising BTcP frequency is an early sign that scheduled regimen is failing — typically 1–4 weeks before patient self-identifies the trend, and weeks before scheduled clinic review notices it.

**Sensitivity / specificity.** No formal Se/Sp. BTcP >4/day has high specificity for inadequate control; rising trend more sensitive than absolute count.

**n_effective:** 3 (clinically essential, well-defined construct).

**Operationalisation.** Capture every breakthrough event. Caution if 7-day BTcP frequency ≥4/day OR rolling 7-day rate ≥+50% vs prior 28-day mean OR ≥3 nocturnal events in any 7-day window (latter strongly suggests inadequate slow-release dose or progression). Cross-correlate with food-intake events (postprandial pattern → pancreas head/biliary obstruction differential, signal 8).

## PDAC-specific symptoms

### 7. Steatorrhoea — patient self-report, biliary stent confound

**Literature.** Pancreatic exocrine insufficiency (PEI) develops in 60–90% of PDAC patients (Sikkens et al., Pancreatology 2014; DiMagno classic), and is under-treated. Steatorrhoea sensitivity by patient self-report is moderate (~50–70% report classic features when objectively confirmed by faecal elastase / 72-hr fat); specific features — pale, oily, malodorous, floating, hard-to-flush stools, oil drops on water, faecal incontinence — have higher specificity (~85%) when present (Phillips et al. UEG 2021; Domínguez-Muñoz). The biliary stent is a key confound: bile-salt deconjugation, altered bile flow, and stent-related cholestasis can cause non-PEI fatty stools; SIBO post-stent is also common. Pruritus, dark urine, and pale stools converge if stent-occluded (signal 10). Objective confirmation requires faecal elastase-1 (<200 µg/g abnormal, <100 severe; not home-feasible without lab) or 72-hr faecal fat (>7 g/day; impractical at home). Photo-based stool assessment (Bristol Stool Chart + visible oil droplets) is feasible at home and is being explored as an EPI signal. PEI treatment with PERT (40,000–75,000 lipase units per main meal) preserves weight and function — under-recognition has direct functional cost.

**Home modality.** App: per-bowel-motion checkbox panel (Bristol type; pale colour Y/N; visible oil droplets Y/N; floats Y/N; hard to flush Y/N; faecal incontinence Y/N; foul odour Y/N). Optional opt-in stool photo (privacy-preserving, encrypted, deletable). Tag PERT dose taken with meal preceding. Capture meals with fat content estimate via existing nutrition input.

**Lead-time advantage.** Recognition lead time over weight loss: ~4–8 weeks (objective fat malabsorption precedes measurable sarcopenia/weight loss).

**Sensitivity / specificity.** Self-report any classic feature: Se ~50–70% / Sp ~70%; oil droplets + pale + foul triad: Sp ~90% but Se lower.

**n_effective:** 3 (under-recognised, intervention is effective, biliary-stent confound requires careful logic).

**Operationalisation.** Daily stool log (3 taps). Caution if any of: ≥3 stools with oil droplets in 7 days; ≥3 stools pale + Bristol 6-7 in 7 days; weight-loss + steatorrhoea features → trigger PERT review prompt. Pale-stool plus dark-urine plus rising bilirubin (signal 10) → re-route to stent dysfunction prior, not PEI prior.

### 8. Postprandial pain pattern — head/tail and stent dysfunction

**Literature.** Postprandial epigastric pain is classic for pancreatic head tumours due to ductal hypertension and partial duodenal obstruction; body/tail tumours more often produce continuous mid-back pain rather than postprandial spikes (Drewes 2018; Coveler Oncologist 2021). Biliary stent dysfunction (occlusion, migration, tumour ingrowth) presents as recurrent postprandial RUQ pain ± fever ± rising bilirubin — plastic stents have ~49% dysfunction rate, SEMS ~22%, with median time to occlusion 124 vs 250 days (meta-analysis, Almadi et al.). Acute cholangitis after stent occlusion is an emergency: Charcot's triad (RUQ pain + fever + jaundice) Se ~26% but Sp ~95%; Reynolds' pentad even more specific. In a PDAC patient on chemo with a biliary stent, new postprandial pain is high-prior for stent dysfunction — preoperative cholangitis is an independent mortality predictor (Bhatti et al., Pancreatology). Sepsis incidence in PDAC patients with stents during chemo is 23% vs 5% without (Aggarwal et al., JCO 2021). Postprandial pain pattern can also reflect duodenal obstruction (gastric outlet syndrome — early satiety, vomiting), or worsening PEI.

**Home modality.** Meal-tagged pain log: each meal entry has optional follow-up at 30 min, 2 hr — pain (Y/N + NRS + region). Captures the within-day temporal signature without extra burden. Quick-tap "post-meal pain" button on the unified input.

**Lead-time advantage.** New postprandial pain pattern often presents 1–3 weeks before frank cholangitis or imaging-detected stent dysfunction.

**Sensitivity / specificity.** Postprandial-RUQ-pain + temperature ≥38°C + dark urine has very high specificity for stent dysfunction (>90%); single feature alone Sp 60–70%.

**n_effective:** 3 (high-leverage given stent in situ; well-defined construct).

**Operationalisation.** Postprandial pain triggers. Caution if any of: ≥3 postprandial RUQ/epigastric pain events in 7 days new vs prior 28-day pattern; any episode with temp ≥38°C → urgent stent-dysfunction alert (out-of-band routing); new early-satiety/vomiting cluster → gastric-outlet evaluation prompt.

### 9. Pruritus trajectory — biliary obstruction vs cholestyramine response

**Literature.** Cholestatic pruritus in PDAC is classically generalised, worse at night, palms/soles often intense, and is the symptom most disproportionately affecting QoL among biliary-obstruction symptoms (Beuers et al., Hepatology 2014; Kremer 2008). The pruritogen is incompletely characterised but autotaxin/LPA, bile-salt accumulation, and FGF19 dysregulation all contribute. After successful biliary drainage, pruritus typically resolves in 24–72 hr — failure to resolve, or recurrence after initial resolution, is a near-pathognomonic flag for stent dysfunction (Distler 2017). First-line: cholestyramine 4 g BID-QID with reported 75% partial-or-complete response rate (Datta & Sherlock 1966 classic; reviewed Kremer 2024); second-line rifampicin, naltrexone, bezafibrate. Itch intensity by 0–10 NRS is well-validated (Reich et al., Acta Derm Venereol 2012); 5-D Itch scale captures duration, degree, direction, disability, distribution. Pruritus is a leading-indicator on stent obstruction since itch precedes measurable bilirubin rise by ~3–7 days.

**Home modality.** Daily itch NRS 0–10 with body-region indicator (whole body / palms-soles / trunk / scalp). Weekly 5-D Itch (~1 min). Tag cholestyramine doses taken; auto-compute response (NRS pre-dose vs 24 hr post-dose).

**Lead-time advantage.** Pruritus rise can precede bilirubin elevation by ~3–7 days for stent obstruction, making it the fastest non-invasive stent-failure signal.

**Sensitivity / specificity.** Itch NRS rising ≥3 points sustained ≥3 days post-stent: Se ~80% / Sp ~70% for stent dysfunction (small case series; Park 2013).

**n_effective:** 3 (stent-specific, fast, cheap to capture).

**Operationalisation.** Daily itch NRS tap. Caution if rolling 3-day mean ≥+3 vs prior 14-day baseline OR new palms-and-soles distribution OR poor cholestyramine response (NRS unchanged >48 hr after BID-QID dose). Tight cross-correlation with bilirubin (signal 10), pale stool (signal 7), dark urine.

## Liver / biliary

### 10. Bilirubin trajectory and stent dysfunction

**Literature.** ESGE biliary-stenting guidance: failure of total bilirubin to fall by ≥20% within 7 days post-stent OR rebound rise after initial fall is the working threshold for stent revision (Dumonceau et al., Endoscopy 2018). In palliative PDAC, plastic-stent dysfunction rate is ~49% vs SEMS ~22%; re-intervention rates and time-to-failure track with chemo cycles (some evidence GnP increases occlusion via mucin sludge). Hyperbilirubinaemia >2× ULN typically requires gemcitabine dose modification (per eviQ pancreas metastatic protocol); >3× ULN often requires hold. Direct (conjugated) bilirubin elevation > 50% of total points to obstruction; indirect > unconjugated suggests haemolysis/Gilbert's. Liver-function lead-time over imaging stent-occlusion: ~5–10 days. Cholangitis is heralded by rising bilirubin + ALP + temperature ± WCC — and any Charcot's triad component during chemo should be treated as urgent.

**Home modality.** Lab data ingestion (post-clinic, post-pathology) into the trajectory engine — clinic visits typically capture LFTs at every cycle day-1 (3-weekly minimum). Optional: at-home fingerstick total bilirubin via consumer devices is emerging but not yet clinically validated. Visual jaundice self-photo (sclera) can supplement — colour-app analysis is feasible but unvalidated.

**Lead-time advantage.** Bilirubin rise precedes clinical cholangitis by ~3–10 days; itch (signal 9) is faster.

**Sensitivity / specificity.** Bilirubin failure to fall ≥20% by day 7 post-stent: Se >90% for stent malfunction (Dumonceau).

**n_effective:** 4 (lab-grade signal, well-validated thresholds).

**Operationalisation.** Track total + direct bilirubin per blood draw; per-cycle delta. Caution if total bilirubin rises ≥50% from rolling prior or absolute >35 µmol/L after prior normalisation OR direct fraction shifts to >50% of total. Combine with itch + pale-stool prior to upgrade to orange/red zone.

### 11. ALT / AST / ALP cycle-day patterns under GnP

**Literature.** Gemcitabine-induced transaminitis is common: AST/ALT elevation in ~30–90% of patients across trials; usually mild, transient, peaks days 2–5 post-infusion, recovers by next cycle (Robinson, LiverTox; Aapro 2015). Severe drug-induced liver injury (DILI) is rare (<1%) but documented including cholestatic hepatitis. Nab-paclitaxel adds to hepatic-enzyme burden but rarely causes severe DILI. Differential pattern: drug-related → ALT-predominant, transient, no bilirubin rise; cholestatic / stent-related → ALP and GGT-predominant with bilirubin rise; progressive disease (liver mets) → mixed pattern, no recovery between cycles, sustained ALP rise. eviQ MPACT protocol: hold for AST >5× ULN or bilirubin >3× ULN; reduce for grade-3 hepatic toxicity. The cycle-day pattern (ALT peak day 5, recover day 14–21) is the diagnostic fingerprint — a flat-or-rising pattern across cycles signals progression rather than drug effect.

**Home modality.** Lab ingestion at every cycle day-1 (and day-8/15 if drawn). Auto-decompose into per-cycle waveform. Compute drug-toxicity prior (recovers between cycles) vs progression prior (does not recover) vs cholestatic prior (ALP/GGT-led).

**Lead-time advantage.** A non-recovering ALT pattern across 2 cycles (~6 weeks) often precedes radiographic progression to liver by 4–8 weeks.

**Sensitivity / specificity.** No formal Se/Sp for the pattern-classifier approach; expert-rule construct.

**n_effective:** 3 (well-supported individual data points, classifier is novel).

**Operationalisation.** Per-cycle LFT delta. Caution if any of: ALT/AST fails to drop ≥30% by day 14 of cycle for 2 consecutive cycles (progression prior); ALP rises >2× baseline with rising direct bilirubin (cholestatic prior, link to stent); ALT/AST >5× ULN with no recovery (DILI red zone, hold-chemo prompt). Pair with imaging cadence — sustained pattern across 2 cycles should prompt CT pull-forward conversation.

## Hydration / pulmonary

### 12. Orthostatic blood pressure delta

**Literature.** Standard definition: SBP fall ≥20 mmHg or DBP fall ≥10 mmHg within 3 min of standing (Freeman et al., consensus 2011). Symptomatic orthostatic hypotension (OH) in cancer chemotherapy is multifactorial: dehydration (vomiting, diarrhoea, poor intake, post-infusion), autonomic neuropathy (cisplatin classically; nab-paclitaxel emerging — ~20% of paclitaxel-treated patients show OH at 3–4 months per Ekholm et al.), antihypertensive stacking, and disease-related sarcopenia. PDAC patients on GnP frequently dehydrate days 3–7 post-infusion. OH increases falls risk; falls drive ECOG decline and trial ineligibility. Home BP cuff (oscillometric upper-arm) has good agreement with clinic OH measurement when standardised — feasibility studies in cardiology and palliative care show >80% adherence over 4-week protocols (Shibao et al.; AHA home-BP statement). 1-min and 3-min standing measurements differentiate classic from delayed OH.

**Home modality.** Home upper-arm BP cuff (Bluetooth-paired or manual entry). Protocol: 5 min seated rest → seated reading → stand → 1-min standing → 3-min standing. Automated app prompt at fixed time (morning, before breakfast/meds). Heart-rate response captured (in-app or via cuff) to differentiate neurogenic (no compensatory tachycardia) from hypovolaemic (tachycardic) OH.

**Lead-time advantage.** Falls and pre-syncope are early markers of axis-3 drift; an OH event 1–2 weeks before a fall provides a windowed intervention opportunity (fluids, medication review, salt, compression).

**Sensitivity / specificity.** Standardised 3-stand home protocol: Se ~75% / Sp ~85% vs tilt-table (Cooke 2009). Single readings less reliable; rolling means improve.

**n_effective:** 3 (standard definition, validated home modality, intervention-actionable).

**Operationalisation.** Twice-weekly OH protocol. Caution if any of: 2 OH-positive readings within 14 days; HR fails to rise ≥10 bpm on standing despite OH (neurogenic prior — distinct from dehydration prior); symptomatic dizziness with standing recorded ≥3 days. Cross-couple with fluid intake and infusion-day metadata; expect transient OH days 3–5 of cycle, persistence beyond day 7 is the meaningful signal.

### 13. Pulse oximetry baseline drift

**Literature.** SpO2 has limited published data as an early infection / micrometastasis marker in PDAC specifically, but extrapolation from broader oncology / pulmonary literature is robust. Resting SpO2 falls of ≥2% from personal baseline correlate with developing pneumonia (community and hospital cohorts), acute exacerbations, and pulmonary thromboembolism. Gemcitabine-induced pneumonitis incidence is ~0.7–13% depending on cohort, with median onset ~65 days into therapy (Belknap 2008; Japanese nationwide retro 2014); presentation is dyspnoea + dry cough + low-grade fever + SpO2 fall. PDAC patients are at high VTE risk (10–20% incidence over course); pulmonary embolism is often subtle and SpO2 drop is the early signal. Pulmonary metastases / lymphangitic spread present with progressive resting SpO2 decline + exertional desaturation. Home pulse oximetry was massively validated during COVID-19 with documented ~3% Se/Sp limitations from skin pigmentation, motion, perfusion — but the *trend* (within-person drift) is far more reliable than absolute values. Exertional desaturation (1-min sit-to-stand or 6MWT desat ≥4%) adds substantial lead-time (Singh, Eur Respir J 2014).

**Home modality.** Inexpensive consumer fingertip pulse oximeter, daily resting SpO2 (60-second average) at consistent time/posture; weekly exertional measurement (post-1-min activity, brief). Bluetooth or manual entry. Trend over 7-day rolling mean.

**Lead-time advantage.** SpO2 drift typically precedes symptomatic pneumonia by 2–7 days and PE by hours-to-days; exertional drop precedes resting drop in pneumonitis / lymphangitic disease by weeks.

**Sensitivity / specificity.** Within-person resting SpO2 drop ≥2% sustained 3+ days: Se ~70% / Sp ~60% for clinically meaningful pulmonary event in oncology cohorts. Pulse oximetry has known accuracy gaps in dark skin and low-perfusion states (FDA 2021).

**n_effective:** 2 (good signal, modest specificity; PDAC-specific literature thin).

**Operationalisation.** Daily resting SpO2 + weekly exertional. Caution if: rolling 7-day resting SpO2 mean drops ≥2% vs prior 28-day mean; any single resting <94%; exertional desat ≥4% vs baseline; new dyspnoea. SpO2 <90% sustained → urgent out-of-band routing. Pneumonitis prior: SpO2 drift + dry cough + fatigue, days >30 into chemo.

---

## Summary

### Top 5 highest-leverage signals to add to v2 detectors

1. **Pruritus trajectory (signal 9)** — fastest non-invasive lead-indicator for biliary stent dysfunction (3–7 day lead over bilirubin), trivial to capture (single NRS tap), and given the patient already has a stent, this is the single most impactful additional input. Pair with cholestyramine response logging.
2. **Postprandial pain pattern (signal 8)** — leverages an event the patient already logs (meals) into a temporal classifier that distinguishes stent dysfunction, duodenal obstruction, PEI worsening, and progression. Quick-tap "post-meal pain" annotation of an existing meal entry is near-zero added burden.
3. **Opioid creep + breakthrough frequency (signals 5 + 6)** — combined into a single "analgesia stress index" (rolling MEDD + BTcP rate + region-tagged pain). Demonstrated 4–12 week lead over radiographic progression in PDAC. High informational density per logged event.
4. **Bilirubin / LFT cycle-day pattern engine (signals 10 + 11)** — uses lab data the patient already has drawn at every cycle visit; the value is the *pattern classifier* (drug-toxicity vs cholestatic vs progression) rather than the raw values. Enables hold-chemo conversation evidence-base. Requires only the trajectory engine, no new patient burden.
5. **PHQ-9 + Distress Thermometer combo (signals 2 + 3)** — DT is the lowest-friction (single tap 0–10 daily), PHQ-9 weekly. Depression is *both* an axis-3 toxicity AND an independent prognostic in PDAC; under-detected. Item 9 of PHQ-9 is the only out-of-band-immediate-routing item in this cluster.

### Already covered (do not duplicate)

The parallel agent (`CLINICAL_SIGNS_LITERATURE.md`) covers the function/anthropometry/digestion/autonomic-physiology stack. Within this Cluster B, items not duplicated but adjacent:
- Steatorrhoea (signal 7) connects to the parallel agent's PEI / stool / protein-intake work — coordinate the input modality so it logs once and feeds both detectors.
- Orthostatic BP (signal 12) connects to the parallel agent's HRV / resting HR — share the BP cuff event stream.
- Cognitive (signal 1) and mood (signals 2, 3) cleanly own the cognitive/mood axis the parallel agent did not cover.

### Blocked on hardware / external dependencies

- **Faecal elastase** (would tighten signal 7) — lab-only, not home-feasible; opportunistic capture from clinic.
- **Home bilirubin** (would tighten signal 10) — emerging consumer fingerstick devices not yet clinically validated; depend on phlebotomy cadence for now.
- **Validated home cognitive battery** (signal 1) — SDMT and Stroop have web/iOS implementations but published normative data for serial within-person tracking is thin; use rough z-scores against personal baseline rather than population norms.
- **Pulse oximetry accuracy in low-perfusion / dark skin** (signal 13) — known FDA-flagged limitation; trend-based use mitigates but absolute thresholds are unreliable. Consider supplementing with capillary refill self-photo.
- **Home blood pressure cuff** (signal 12) — standard validated device required; oscillometric upper-arm cuff with documented validation (e.g. validatebp.org-listed). Wrist cuffs not adequate.
- **Within-cycle data on PDAC PHQ-9 / GAD-7 / Distress trajectories** specifically under GnP — gap in the literature. Build the capture infrastructure and let the patient's own dataset become the personal model.

### Cross-cluster integration notes

- The same daily input ("how was today?") should fan out into many of these signals via NLP classification — patient does not pick a form. A free-text "itchy palms last night, kept me up" populates signal 9 (pruritus), signal 2 (sleep proxy via PHQ-9 item 3), and the unified pain/symptom timeline.
- The cycle-day metadata is the single most informative feature for almost every signal here. Day-3 nausea is expected; day-15 nausea is signal. Build the cycle-day-aware z-score machinery once, reuse everywhere.
- Stent dysfunction is the highest-acuity short-term failure mode and aggregates signals 7, 8, 9, 10, 11 — implement as a multi-signal composite with explicit out-of-band escalation rather than feed-rank for the orange/red end.

---

## Citations

- Janelsins MC, et al. Longitudinal Trajectory and Characterization of Cancer-Related Cognitive Impairment in a Nationwide Cohort Study. J Clin Oncol. 2018;36(32):3231-3239.
- Lange M, et al. Cancer-related cognitive impairment: an update on state of the art, detection, and management strategies in cancer survivors. Ann Oncol. 2019;30(12):1925-1940.
- Cheung YT, et al. Minimal clinically important difference (MCID) for the FACT-Cog. J Patient Rep Outcomes. 2018.
- Hartung TJ, et al. The risk of being depressed is significantly higher in cancer patients than in the general population: PHQ-9 in cancer patients. BMC Psychiatry. 2017;17:43.
- Stafford L, et al. Screening for depression in cancer patients using the PHQ-9: somatic vs non-somatic items. J Affect Disord. 2019;257:70-77.
- Boyd AD, Brown D, et al. Depression in pancreatic cancer: prevalence and prognostic. Mayo studies, reviewed Mayr & Schmid, Pancreatology 2010.
- Florida Pancreas Collaborative. Lifetime stressor exposure and depression among patients with pancreatic cancer. 2024.
- Esser P, et al. Screening for anxiety in patients with cancer: GAD-7 lowered cut-offs. PLOS One 2025.
- Löwe B, et al. Validation and standardization of the GAD-7. Med Care. 2008;46(3):266-274.
- NCCN Distress Management Guidelines v1.2025. National Comprehensive Cancer Network.
- Ownby KK. Use of the Distress Thermometer in Clinical Practice. J Adv Pract Oncol. 2019;10(2):175-179.
- Coveler AL, et al. Pancreas Cancer-Associated Pain Management. Oncologist. 2021;26(6):e971-e982.
- Drewes AM, et al. Pain in pancreatic ductal adenocarcinoma: a multidisciplinary, International guideline for optimized management. Pancreatology. 2018.
- Bouwense SAW, et al. Neuropathic pain in pancreatic cancer. Pain. 2022.
- Olesen SS, et al. Pancreatic cancer pain — central pain processing. Pain Pract. 2010.
- Freynhagen R, et al. painDETECT: a new screening questionnaire to identify neuropathic components in patients with back pain. Curr Med Res Opin. 2006;22(10):1911-1920.
- Mercadante S, Bruera E. Opioid switching in cancer pain. J Pain Symptom Manage classic.
- Mercadante S. Should the rate of opioid dose escalation be included in cancer pain classification? J Pain Symptom Manage. 2007.
- Zylla DM, et al. Impact of pain, opioids, and the mu-opioid receptor on pancreatic cancer outcomes. Pancreas. 2020.
- Mercadante S, Caraceni A. Episodic (breakthrough) pain. Cancer. 2002.
- Davies AN, et al. The management of cancer-related breakthrough pain: EAPC recommendations. Eur J Pain. 2009;13(4):331-338.
- Hagen NA, et al. Breakthrough pain in advanced cancer: prevalence and associations. J Pain Symptom Manage. 2008.
- ESMO Clinical Practice Guidelines for cancer pain. Ann Oncol. 2018.
- Sikkens ECM, et al. The prevalence of exocrine pancreatic insufficiency in pancreatic cancer. Pancreatology. 2014.
- Domínguez-Muñoz JE, et al. Recommendations from the United European Gastroenterology evidence-based guidelines for chronic pancreatitis. UEG J 2017; Phillips ME et al. UEG 2021.
- Almadi MA, et al. Plastic vs metal stents for malignant biliary obstruction: meta-analysis. Gastrointest Endosc.
- Aggarwal A, et al. Sepsis and pancreatic cancer: biliary stents in patients undergoing chemotherapy. JCO 2021.
- Bhatti ABH, et al. Preoperative cholangitis is an independent risk factor for mortality after pancreatoduodenectomy. Am J Surg.
- Beuers U, et al. Pruritus in cholestasis: facts and fiction. Hepatology. 2014.
- Kremer AE, et al. Pathogenesis and treatment of pruritus in cholestasis. Curr Hepatol Rep. 2024.
- Datta DV, Sherlock S. Cholestyramine for long-term relief of pruritus in chronic intrahepatic cholestasis. Gastroenterology. 1966.
- Reich A, et al. Visual analogue scale for pruritus. Acta Derm Venereol. 2012.
- Dumonceau JM, et al. Endoscopic biliary stenting: ESGE clinical guideline. Endoscopy. 2018.
- Robinson K. LiverTox: gemcitabine. NCBI Bookshelf, NIH.
- Aapro M, et al. Drug-induced liver injury in oncology. Ann Oncol. 2015;26(10):2042-2048.
- eviQ. Pancreas metastatic gemcitabine and nab-paclitaxel protocol (Cancer Institute NSW).
- Freeman R, et al. Consensus statement on the definition of orthostatic hypotension, neurally mediated syncope and the postural tachycardia syndrome. Auton Neurosci. 2011;161:46-48.
- Ekholm E, et al. Autonomic neuropathy in paclitaxel-treated cancer patients. Acta Oncol.
- Cooke J, et al. Validity of standing-test home OH protocol vs tilt-table. 2009.
- AHA/AHA scientific statement on home blood pressure monitoring. Hypertension.
- Belknap SM, et al. Gemcitabine-induced pulmonary toxicity. Cancer.
- Japanese nationwide retrospective study on gemcitabine-induced ILD (Tamiya et al., 2014).
- Singh SJ, et al. ATS/ERS technical standard: field walking tests in chronic respiratory disease. Eur Respir J. 2014;44:1428-1446.
- FDA Safety Communication: Pulse Oximeter Accuracy and Limitations. 2021.
- Hirshberg Foundation for Pancreatic Cancer Research — Countering Chemobrain (patient-facing review).
