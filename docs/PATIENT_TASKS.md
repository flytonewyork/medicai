# Patient Tasks — custom reminders + cycle-aware surfacing

## What it is

A lightweight schedule of care-adjacent things to remember — environmental
maintenance, dental reviews, nutrition follow-ups, pharmacy refills, admin
work — that surface as CTAs on the dashboard **when they become relevant**,
not on a fixed calendar.

## Schedule kinds

Every task belongs to one of four kinds:

| Kind          | Fires when                                      | Example                                   |
| ------------- | ----------------------------------------------- | ----------------------------------------- |
| `once`        | A single calendar date                          | "Book a dental clean by 2026-06-15"       |
| `recurring`   | Every *N* days; auto-rolls on completion        | "Change aircon filters every 90 days"     |
| `cycle_phase` | During a phase of the active treatment cycle    | "Intensify hand hygiene during nadir"     |
| `cycle_day`   | On a specific day of the active cycle           | "Pre-treatment labs on cycle day 1"       |

Cycle-linked kinds consult the active `treatment_cycle` via the treatment
layer's phase-window definitions.

## Buckets

`getActiveTaskInstances()` sorts every active task into:

- `overdue` — past due
- `due_today` — due today
- `cycle_relevant` — inside the current cycle phase / day
- `approaching` — within the task's `lead_time_days`
- `scheduled` — further out
- `snoozed` — user snoozed until a later date

Dashboard only surfaces the first four — noise is the enemy.

## Presets

`src/config/task-presets.ts` ships 19 curated presets covering:

- Environmental / household: HVAC filters, water filter, bed linen, vacuum
- Dental: toothbrush swap (28d), 6-monthly dental clean
- Nutrition: quarterly dietitian review
- Physio: monthly exercise physiology
- Pharmacy: PERT refill (60d), antiemetic refill (60d)
- Vaccines: annual flu, 6-monthly COVID booster review
- Clinical: annual skin / eye / GP review
- Admin: 6-monthly advance care directive, annual will review
- Cycle-relative: intensive hygiene at nadir, pet-care handoff, pre-dose labs

Each preset has a rationale shown at pick time so the user understands *why*
the task matters.

## Adding custom tasks

`/tasks/new` exposes every schedule kind with the matching fields. Schedule
kind, lead time, and where to surface (dashboard / daily check-in) are all
user-editable.

## Completion + snooze

- **Done** — appends to `completions[]` and, for recurring tasks, advances
  `due_date` by the interval.
- **Snooze 7d** — sets `snoozed_until`; the task disappears from the
  dashboard until that date.

## Extending

Add a new preset: append to `TASK_PRESETS` in `src/config/task-presets.ts`.
No code change required to the engine or UI.

Add a new category: extend the `TaskCategory` union in
`src/types/task.ts` and add the label to the `PresetPicker` grouping.

Add a new schedule kind: extend `TaskScheduleKind` + the matching branch in
`computeTaskInstance()` + the editor's schedule tabs.
