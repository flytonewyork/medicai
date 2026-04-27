# Data Schema

## Database

IndexedDB via Dexie.js. Database name: `anchor_db`, version: 1.

All rows include `id`, `created_at`, `updated_at`, and an `entered_by` role
marker where a human submitted the row.

## Tables

- `daily_entries` — one row per day
- `weekly_assessments` — one row per week
- `fortnightly_assessments` — one row per 2 weeks
- `quarterly_reviews` — one row per 3 months
- `labs`
- `imaging`
- `ca199_results`
- `ctdna_results`
- `molecular_profile` — singleton
- `trials`
- `treatments`
- `medications`
- `life_events`
- `decisions`
- `zone_alerts`
- `family_notes`
- `settings` — singleton (user profile, baselines, locale)

Full type definitions live in `src/types/` and the Dexie schema in
`src/lib/db/dexie.ts`.

## Key types (abbreviated)

### DailyEntry

```ts
interface DailyEntry {
  id?: number;
  date: string;               // YYYY-MM-DD
  entered_at: string;         // ISO datetime
  entered_by: "hulin" | "catherine" | "thomas";
  energy: number;             // 0–10
  sleep_quality: number;
  appetite: number;
  pain_worst: number;
  pain_current: number;
  mood_clarity: number;
  nausea: number;
  weight_kg?: number;
  steps?: number;
  practice_morning_completed: boolean;
  practice_morning_quality?: number;
  practice_evening_completed: boolean;
  practice_evening_quality?: number;
  cold_dysaesthesia: boolean;
  neuropathy_hands: boolean;
  neuropathy_feet: boolean;
  mouth_sores: boolean;
  diarrhoea_count: number;
  new_bruising: boolean;
  dyspnoea: boolean;
  fever: boolean;
  fever_temp?: number;
  reflection?: string;
  reflection_lang?: "en" | "zh";
}
```

### Settings

```ts
interface Settings {
  id?: number;
  profile_name: string;
  dob?: string;
  diagnosis_date?: string;
  baseline_weight_kg?: number;
  baseline_date?: string;
  baseline_grip_dominant_kg?: number;
  baseline_grip_nondominant_kg?: number;
  baseline_gait_speed_ms?: number;
  baseline_sit_to_stand?: number;
  locale: "en" | "zh";
  managing_oncologist?: string;
}
```

## Persistence and backup

- Auto-save on each field blur / debounced change.
- Manual backup: export-all → JSON file download.
- Manual restore: import JSON → validate with Zod → upsert.

## Sync semantics

The cloud mirror lives in Supabase as a single `cloud_rows` table
keyed by `(table_name, household_id, local_id)`. Every Dexie write
queues a row through `src/lib/sync/queue.ts`; the row carries a
JSON-encoded `data` blob plus the row's `updated_at`.

**Conflict resolution: last-write-wins.** When two devices edit the
same row offline and reconnect, the row with the later
`updated_at` overwrites the earlier one. There's no merge, no
operation log, no per-field reconciliation — the loser's edit is
silently discarded.

This is acceptable today because Anchor is single-patient with at
most one active editor on a given row at a time:

  - The patient logs from their phone.
  - The primary carer reviews + edits from a laptop, usually not
    while the patient is also editing the same row.
  - Clinicians attach notes; they don't co-edit existing rows.

The cases where last-write-wins becomes a real problem are:

  - Two devices simultaneously running auto-save on the same daily
    entry (carer typing on laptop while the patient touches a chip
    on their phone).
  - Two carers concurrently editing a treatment plan or medication.

**Future work: CRDT or op-log.** When concurrent editing on the same
row becomes routine — a second active editor (carer + patient on the
same row), or multiple clinicians in the chart — the queue should
move to either:

  1. A field-level CRDT (Yjs or Automerge per row), or
  2. An append-only op-log keyed by `(row_id, op_id)` with a server-
     side merge + materialised view back into `cloud_rows`.

Both approaches lose nothing. We're deferring this until the
single-active-editor assumption breaks, because the implementation
complexity is non-trivial and the current single-patient pattern
hasn't surfaced a real conflict yet.

If you're adding a new write path that *does* assume concurrent
editing (e.g. a shared family-note thread), call it out in the
queue test suite and flag it here so the next reviewer can decide
whether to upgrade the consistency model now or carry the risk.
