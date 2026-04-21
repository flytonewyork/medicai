// List of Dexie tables that mirror to Supabase `cloud_rows`.
// Add new tables here as they're introduced in dexie.ts.
// Ephemeral / derived tables (none today) can be excluded.
export const SYNCED_TABLES = [
  "daily_entries",
  "weekly_assessments",
  "fortnightly_assessments",
  "quarterly_reviews",
  "labs",
  "imaging",
  "ctdna_results",
  "molecular_profile",
  "trials",
  "treatments",
  "medications",
  "medication_events",
  "medication_prompt_events",
  "change_signals",
  "signal_events",
  "life_events",
  "decisions",
  "zone_alerts",
  "family_notes",
  "settings",
  "pending_results",
  "ingested_documents",
  "comprehensive_assessments",
  "treatment_cycles",
  "patient_tasks",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
