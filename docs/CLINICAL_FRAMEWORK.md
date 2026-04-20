# Clinical Framework — Function Preservation Strategy

## Core philosophy

Function is a depletable resource. The platform's job is to detect drift before
it crosses clinical thresholds that break trial eligibility.

## The three axes of ECOG decline

1. **Tumour burden** — measured on imaging; the oncologist's scorecard.
2. **Cancer-driven symptoms** — pain, cachexia from tumour bulk; potentially
   reversible with response.
3. **Treatment-driven toxicity** — neuropathy, myelosuppression, sarcopenia,
   deconditioning. Often irreversible once established.

Standard oncology monitors axis 1 every 2–3 months and axis 2 at clinic visits.
Axis 3 drift is the blind spot, and is where ECOG eligibility quietly erodes.

## Tier 1: Daily tracking (targeted <2 min)

Subjective 0–10 scales:
- Energy
- Sleep quality
- Appetite
- Pain (worst in last 24h, current)
- Mood / mental clarity
- Nausea

Objective:
- Weight (kg, once daily morning)
- Steps (from phone/watch, optional)

Practice:
- Morning practice completed (y/n, quality 0–5)
- Evening practice completed (y/n, quality 0–5)

Symptom flags (checkboxes):
- Cold dysaesthesia
- Neuropathy (hands, feet — independent)
- Mouth sores
- Diarrhoea episode count
- New bruising / bleeding
- Dyspnoea
- Fever (temperature if present)

Optional free-text reflection (EN or ZH).

## Tier 2: Weekly assessment (Sunday evening)

- Practice completion: full / reduced / skipped per day
- Functional integrity aggregate (self-rated 1–5)
- Cognitive / stillness aggregate (self-rated 1–5)
- Social / practice integrity aggregate (self-rated 1–5)
- Week summary auto-generated from daily entries

## Tier 3: Fortnightly clinical assessment

Validated instruments:
- Self-reported ECOG (with tooltip explanations to reduce drift from clinician-rated)
- PRO-CTCAE subset: fatigue, neuropathy, GI, pain (5-point scales per item)
- PHQ-9 and GAD-7 (monthly rotation acceptable)
- Distress thermometer (0–10)

Objective functional tests (self-measured or clinic-captured):
- Grip strength (dominant and non-dominant, kg, dynamometer)
- 4-m gait speed (m/s)
- 30-second sit-to-stand (count)

Nutritional status:
- MUAC (mid-upper arm circumference, cm)
- Calf circumference (cm)
- Albumin (from labs)

Neuropathy scoring:
- Total Neuropathy Score (TNS) components
- Functional impact questions (buttons, keys, writing, standing balance)

## Tier 4: Quarterly comprehensive review

- 12-week trends for all Tier 1–3 variables
- Imaging: CT dates, findings summary, RECIST status
- CA19-9 trend
- ctDNA dynamics if available
- Sarcopenia proxy from CT L3 SMI (if radiologist provides), or MUAC/calf as proxy
- Formal Comprehensive Geriatric Assessment checklist (modified)

## Zone thresholds (binding for engine)

### Green zone
- ECOG 0–1
- Weight stable within 5% of baseline
- Grip strength within 10% of baseline
- Gait speed >1.0 m/s
- Practice completion ≥5/7 days
- Neuropathy grade 0–1
- No hospitalisations
- Stable mood / stillness

### Yellow zone (mandatory review)
- 5–10% weight loss over 3 months
- 10–20% grip strength decline
- Gait speed 0.8–1.0 m/s
- Practice completion 3–4/7 days for ≥2 consecutive weeks
- Neuropathy grade 2
- Grade 3 non-haematological toxicity
- CA19-9 rising 3 consecutive measurements
- PHQ-9 ≥10 or GAD-7 ≥10
- Sleep quality declining ≥2 points on 0–10 scale for 2 consecutive weeks

### Orange zone (urgent review, active de-escalation)
- >10% weight loss
- >20% grip strength decline
- Gait speed <0.8 m/s
- Practice completion ≤2/7 for 2+ weeks
- Neuropathy grade 3
- Grade 4 non-haematological toxicity
- RECIST progression on imaging
- PHQ-9 ≥15 or GAD-7 ≥15

### Red zone (immediate action)
- Febrile neutropenia
- New deep venous thrombosis / pulmonary embolism
- Bowel obstruction
- Biliary obstruction with cholangitis
- Suicidal ideation
- Hospitalisation for any reason

## Treatment levers (see TREATMENT_LEVERS.md)

Levers are categorised: intensity, supportive, nutritional, physical,
psychological / spiritual, complementary, bridge, monitoring, emergency.
