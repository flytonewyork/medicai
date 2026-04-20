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
