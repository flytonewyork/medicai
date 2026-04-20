# Treatment Lever Library

All levers are defined in `src/config/treatment-levers.json` for runtime
editability.

## Categories

- `intensity` — dose and schedule modifications
- `supportive` — prevention and symptom management
- `nutrition` — nutritional interventions
- `physical` — physical conditioning
- `psychological` — mental / spiritual support
- `complementary` — integrative therapies
- `bridge` — trial and next-line therapy
- `monitoring` — additional surveillance
- `emergency` — acute care

## Selected lever descriptions

### Intensity

- `intensity.dose_reduce` — 20% reduction per level of gem or nab-paclitaxel.
- `intensity.drop_d15` — move weekly GnP to biweekly.
- `intensity.maintenance` — drop nab-paclitaxel; gem monotherapy maintenance
  after response plateau.
- `intensity.holiday` — planned 2–4 week break for life events or recovery.
- `intensity.hold` — immediate hold pending toxicity resolution.

### Supportive

- `supportive.gcsf_prophylaxis` — pegfilgrastim / lipegfilgrastim after cycle.
- `supportive.olanzapine` — 2.5–5 mg nocte for nausea.
- `supportive.duloxetine` — 30–60 mg for CIPN.
- `supportive.vte_prophylaxis` — apixaban 2.5 mg BD.
- `supportive.pert` — Creon 25 000–50 000 with meals, 10 000 with snacks.

### Nutrition

- `nutrition.dietitian` — specialist oncology dietitian referral.
- `nutrition.supplements` — ONS (Ensure Plus, Fortisip) between meals.
- `nutrition.feeding_tube` — PEG / NJ if oral intake fails.

### Physical

- `physical.exercise_phys` — cancer-trained exercise physiologist referral.
- `physical.resistance` — progressive resistance training, 2–3x weekly.

### Psychological

- `psychological.psychology` — clinical psychology referral.
- `psychological.medication` — SSRI / SNRI consideration.
- `psychological.meditation_teacher` — continued practice support.

### Bridge

- `bridge.trigger_2l` — initiate 2L trial workup at progression.
- `bridge.trial_enrollment` — activate RASolute 302 / expanded access.
- `bridge.accelerate` — if functional decline risks breaking eligibility.

### Monitoring

- `monitoring.imaging_early` — advance CT window.
- `monitoring.ctdna` — ctDNA assay for molecular progression.

### Emergency

- `emergency.hospital` — immediate ED presentation.
