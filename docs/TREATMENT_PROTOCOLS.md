# Treatment Protocols

The treatment layer adds protocol awareness across every Anchor module:
on each cycle day, the system surfaces contextual nudges across diet,
hygiene, exercise, sleep, mental, safety, activity, meds, and intimacy.

## Concepts

- **Protocol** — reusable definition. `cycle_length_days`, `dose_days`,
  `agents`, `phase_windows`, `side_effect_profile`. Lives in
  `src/config/protocols.ts`.
- **TreatmentCycle** — instance with a real `start_date`. Cycle day =
  `differenceInCalendarDays(today, start_date) + 1`. Stored in Dexie
  table `treatment_cycles` (added in v4 migration).
- **NudgeTemplate** — protocol-keyed, day-banded advisory tagged by
  category and severity (info / caution / warning). Lives in
  `src/config/treatment-nudges.ts`.

## Protocols shipped

| ID | Cycle | Dose days | Notes |
|---|---|---|---|
| `gnp_weekly` | 28 d | D1, D8, D15 | Primary GnP — most nudges keyed here |
| `gnp_biweekly` | 28 d | D1, D15 | Function-preserving schedule |
| `gem_maintenance` | 28 d | D1, D8, D15 | Gem-only after response plateau |
| `mffx` | 14 d | D1 (+ 46 h pump → D2) | Modified FOLFIRINOX |

## Phase windows (GnP weekly)

```
D1   D8   D15  D16─D21  D22─D28
●    ●    ●    nadir    recovery
```

Nudges target each window: pre-dose hydration on dose days, cold-food
warning D1–D3, protein push D4–D7, hygiene + crowd-avoid + twice-daily
temp through nadir, exercise + meaningful contact through recovery.

## Engine (`src/lib/treatment/engine.ts`)

```ts
buildCycleContext(cycle, today, symptomFlags) => {
  cycle, protocol, cycle_day, phase, is_dose_day,
  days_until_next_dose, days_until_nadir,
  applicable_nudges  // already filtered + sorted by severity
}
```

Symptom flags are derived from the latest daily entry (`fever`,
`nausea ≥ 5`, `diarrhoea ≥ 3`, `neuropathy hands/feet`,
`appetite ≤ 3`) and feed conditional nudges.

## Surfaces

- **Dashboard** — `CycleDayCard` shows cycle day, phase, top 3 nudges
  for today
- **Daily check-in** — `CycleBanner` shows up to 2 most-urgent nudges
  before the wizard
- **Treatment routes**:
  - `/treatment` — list of cycles
  - `/treatment/new` — protocol picker
  - `/treatment/[id]` — calendar grid + all nudges grouped by category
    + protocol details + side-effect profile

## Customising

Add protocols by extending `PROTOCOL_LIBRARY` in
`src/config/protocols.ts`. Add nudges by appending to `NUDGE_LIBRARY`
in `src/config/treatment-nudges.ts` — each nudge specifies the
`protocol_ids` it applies to, the inclusive `day_range`, category,
severity, and bilingual title + body. No code changes required for
new content.

Patient can snooze any individual nudge for the active cycle (stored
on the cycle record; restored from the cycle detail page).
