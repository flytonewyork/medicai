# Medications module — design

Covers drug/behavioural-intervention logging, custom recurrence,
per-drug profile pages, and the interaction matrix. Builds on the
existing `protocols.ts` + `treatment-levers.json` + `PatientTask`
infrastructure rather than replacing it.

## Purpose

Three jobs, in priority order:

1. **Log adherence.** Every dose of every scheduled drug (chemo,
   supportive, symptom-driven, behavioural) can be logged in under
   5 seconds. Missed-dose data feeds the zone engine and the trial
   eligibility narrative.
2. **Drive a dosing schedule.** Defaults for the protocol-linked
   drugs (PERT, dex, ondansetron, olanzapine, duloxetine, apixaban,
   narmafotinib) ship pre-configured. User can override with a
   highly-custom schedule (taper, pulse, alternate-day, as-needed).
3. **Per-drug profile page.** Bilingual. Curated, not fetched.
   Covers mechanism, schedule, side-effect profile, drug–drug
   interactions against active meds, and drug–diet interactions.

## Scope

**In:** Meds and behavioural interventions (qigong, meditation,
resistance training sessions) that the patient wants to track on
a recurring schedule.
**Out:** Dose calculation, prescription generation, interaction
lookup against a general-purpose pharmacology DB, pill-reminder
push-notifications (phase 2).

## Data model

### New types (`src/types/medication.ts`)

```ts
export type MedicationRoute = "PO" | "IV" | "SC" | "IM" | "topical" | "PR";
export type MedicationCategory =
  | "chemo"          // backbone chemo agent (gem, nab-p, narmafotinib)
  | "antiemetic"
  | "steroid"
  | "pert"           // pancreatic enzyme replacement
  | "neuropathy"
  | "anticoagulant"
  | "gcsf"
  | "analgesic"
  | "sleep"
  | "behavioural"    // qigong, meditation, resistance training
  | "supplement"
  | "other";

export type ScheduleKind =
  | "fixed"          // e.g. BID at 08:00 + 20:00
  | "with_meals"     // resolves to meal times from user profile
  | "prn"            // as-needed, surface only for logging
  | "cycle_linked"   // fires on cycle days (e.g. dex D1/D8/D15)
  | "taper"          // stepwise dose reduction
  | "custom";        // rrule-like expression

export interface DoseSchedule {
  kind: ScheduleKind;
  // kind = "fixed" | "with_meals"
  times_per_day?: number;
  clock_times?: string[];         // ["08:00", "20:00"]
  // kind = "cycle_linked"
  cycle_days?: number[];          // [1, 8, 15]
  hold_on_infusion_day?: boolean;
  // kind = "taper"
  taper_steps?: { dose: string; duration_days: number }[];
  // kind = "custom"
  rrule?: string;                 // RFC 5545 subset
  // all kinds
  start_date?: string;
  end_date?: string;
}

export interface MedicationRecord {         // Dexie table: `medications`
  id?: number;
  drug_id: string;                          // joins to DRUG_REGISTRY
  display_name?: string;                    // override for custom drugs
  category: MedicationCategory;
  dose: string;                             // "400 mg", "25 000 units"
  route: MedicationRoute;
  schedule: DoseSchedule;
  active: boolean;
  notes?: string;
  started_on: string;
  stopped_on?: string;
  created_at: string;
  updated_at: string;
}

export interface DoseLogEntry {             // Dexie table: `dose_logs` (v6)
  id?: number;
  medication_id: number;
  scheduled_at?: string;                    // ISO — if fixed schedule
  logged_at: string;                        // ISO
  taken: boolean;                           // false = explicit miss
  dose_taken?: string;                      // override if different
  note?: string;
  source: "check_in" | "quick_log" | "backfill";
}
```

### Dexie migration — v6

- Reuse the existing `medications` table (unused since v1). Add
  indexes: `++id, drug_id, active, category`.
- New table `dose_logs` — `++id, medication_id, logged_at`.
- No data migration required; `medications` is empty.

### Drug registry (`src/config/drug-registry.ts`)

Static, curated, bilingual. One record per drug Hu might encounter.
Seed list on v1:

| drug_id | Category | Linked protocol / lever |
|---|---|---|
| `gemcitabine` | chemo | `gnp_*`, `mffx`, `gem_maintenance` |
| `nab_paclitaxel` | chemo | `gnp_*` |
| `narmafotinib` | chemo | `gnp_narmafotinib` |
| `oxaliplatin` | chemo | `mffx` |
| `irinotecan` | chemo | `mffx` |
| `fluorouracil` | chemo | `mffx` |
| `leucovorin` | chemo | `mffx` |
| `dexamethasone` | steroid | GnP premed |
| `ondansetron` | antiemetic | GnP premed |
| `olanzapine` | antiemetic | `supportive.olanzapine` |
| `aprepitant` | antiemetic | mFFX premed |
| `pancrelipase` | pert | `supportive.pert` (Creon) |
| `duloxetine` | neuropathy | `supportive.duloxetine` |
| `apixaban` | anticoagulant | `supportive.vte_prophylaxis` |
| `pegfilgrastim` | gcsf | `supportive.gcsf_prophylaxis` |
| `loperamide` | other | mFFX rescue |
| `paracetamol` | analgesic | prn |
| `melatonin` | sleep | prn |

Plus three behavioural-intervention records (qigong, meditation,
resistance training). Same shape, category `"behavioural"`, dose
represented as duration ("20 min"), route irrelevant.

### Drug record shape

```ts
export interface DrugInfo {
  id: string;
  name: LocalizedText;
  aliases?: string[];                          // "Creon", "Abraxane"
  class: LocalizedText;                        // mechanism class
  mechanism: LocalizedText;                    // 2–3 sentences
  default_schedules: DoseSchedule[];           // offered when user adds it
  side_effects: {
    common: LocalizedText[];                   // each bullet bilingual
    serious: LocalizedText[];                  // red-flag list
  };
  monitoring: LocalizedText[];                 // labs / clinical
  diet_interactions: DietInteraction[];
  references?: { title: string; url: string }[];
}

export interface DietInteraction {
  food: LocalizedText;                         // "grapefruit", "alcohol"
  effect: LocalizedText;                       // plain-English effect
  severity: "info" | "caution" | "warning";
}
```

### Interaction matrix (`src/config/drug-interactions.ts`)

Tuple-based, curated. Only pairs that matter for the current drug
set — not general-purpose.

```ts
export interface DrugInteraction {
  pair: [string, string];                      // [drug_id_a, drug_id_b]
  severity: "info" | "caution" | "warning";
  effect: LocalizedText;
  management: LocalizedText;
}
```

Runtime check: compute `interactionsFor(activeDrugIds)` =
`matrix.filter(e => pair ⊂ active)`. Surface on (1) each drug's
profile page, (2) as a warning nudge on the daily check-in when a
newly-added med overlaps.

## UI surfaces

### `/medications` — list
Active meds at top, grouped by category. Each row: dose, schedule
summary ("BID with meals"), last-logged badge, quick-log button.

### `/medications/[id]` — profile
Sections:
- Header: name (bilingual), class, alias pills.
- Dosing card: current schedule, next dose time, taper preview.
- Mechanism: 2–3 sentences, patient-friendly tone.
- Side effects: common vs. serious (collapsible).
- Monitoring: which labs, what to watch for.
- Interactions:
  - Drug–drug against all active meds (filtered interaction matrix)
  - Drug–diet (from `diet_interactions`)
- References: linked but never auto-fetched.
- Log history: reverse-chronological dose log.

### Quick-log FAB (global)
Floating button on dashboard + daily check-in. Opens a sheet with
"due now" meds pre-selected, one tap to log all-taken, swipe to
mark missed, free-text note optional.

### Daily check-in integration
New step: "Meds taken?" — lists today's scheduled doses, defaults
all to taken, user unchecks any missed. Writes `DoseLogEntry` rows
with `source: "check_in"`.

### Nudges
Extend `treatment-nudges.ts` with `medication_id` — optional link
from a nudge to a specific med so tapping it jumps to the profile.
New automatic nudges for:
- Interaction warning (when user adds a new med that interacts)
- Adherence drift (≥ 3 missed doses of same drug in 7 days)
- Taper step-down (on scheduled step-down day)

## Custom recurrence

`ScheduleKind = "custom"` uses an **rrule subset** (no iCalendar
parser dependency — parse a small DSL):

```
FREQ=DAILY;INTERVAL=1;BYHOUR=8,14,20           // TID
FREQ=WEEKLY;BYDAY=MO,WE,FR                     // MWF
FREQ=DAILY;INTERVAL=2;COUNT=14                 // alternate-day for 2 weeks
```

Parser lives in `src/lib/medication/schedule.ts`. Tested against
a fixture set in `tests/unit/medication-schedule.test.ts`.

## i18n & tone

- All user-facing copy uses `LocalizedText`.
- Match the existing measured, honest tone. No warning words for
  routine things; reserve `severity: "warning"` for genuine safety.
- Drug names: English primary + zh translation. Chinese brand
  names where widely used (e.g. 力度伸 for effervescent vitamin C
  — not relevant here, but the pattern applies).

## Build order

Each step is a merge-able slice.

1. **Drug registry + profile page (read-only).**
   Seed `drug-registry.ts`, create `/medications` and
   `/medications/[id]` routes. No logging yet. Gives us bilingual
   drug info with zero new schema.
2. **Medication records + scheduling.**
   Dexie v6 migration, add/edit med form, schedule composer.
   Surface on the list page. No logging yet.
3. **Dose logging (quick-log FAB + check-in step).**
   `dose_logs` table, quick-log sheet, daily check-in integration.
4. **Interaction matrix.**
   `drug-interactions.ts`, surface on profile + as nudge.
5. **Adherence signals.**
   Missed-dose detection → nudge → feeds zone engine as a
   yellow-zone trigger (≥ 3 missed antiemetic doses = nausea axis-2
   under-control).

## Open questions

- **Behavioural interventions**: same table, or a sibling
  `practices` table? Leaning same-table + `category: "behavioural"`
  to reuse the scheduling + logging machinery. Decide before step 2.
- **Alarms / push notifications**: out of MVP scope. Log-after-the-
  fact is the contract. Revisit if adherence signal shows real drift.
- **Drug–lab overlay**: should the profile page embed relevant lab
  trends (e.g. LFTs on the narmafotinib page)? Punt to step 5.
- **Free-text custom drugs**: allow `drug_id: "custom:<slug>"` for
  one-offs that aren't in the registry. Profile page degrades to
  just the user-entered fields.
