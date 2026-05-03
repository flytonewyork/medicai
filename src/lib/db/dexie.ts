import Dexie, { type Table } from "dexie";
import type {
  CareTeamContact,
  ChangeSignalRow,
  DailyEntry,
  WeeklyAssessment,
  FortnightlyAssessment,
  QuarterlyReview,
  LabResult,
  Imaging,
  CtdnaResult,
  MolecularProfile,
  Treatment,
  LifeEvent,
  Decision,
  ZoneAlert,
  FamilyNote,
  Settings,
  PendingResult,
  IngestedDocument,
  ComprehensiveAssessment,
  PdfBlob,
  SignalEventRow,
  ProvisionalSignalRow,
  SignalLabelRow,
} from "~/types/clinical";
import type { Trial } from "~/types/bridge";
import type { TreatmentCycle } from "~/types/treatment";
import type { PatientTask } from "~/types/task";
import type { CareTeamMember } from "~/types/care-team";
import type {
  Medication,
  MedicationEvent,
  MedicationPromptEvent,
} from "~/types/medication";
import type {
  AgentFeedbackRow,
  AgentFollowUpRow,
  AgentRunRow,
  AgentStateRow,
  LogEventRow,
} from "~/types/agent";
import type { Appointment, AppointmentLink } from "~/types/appointment";
import type { TimelineMedia } from "~/types/timeline";
import type {
  BiographicalOutline,
  MemoryCluster,
  ProfileAspect,
  ProfileConsent,
  ProfileEntry,
  ProfilePrompt,
} from "~/types/legacy";
import type {
  FoodItem,
  MealEntry,
  MealItem,
  FluidLog,
  MealTemplate,
} from "~/types/nutrition";
import type { HouseholdProfile as HouseholdProfileRow } from "~/types/household-profile";
import type { VoiceMemo } from "~/types/voice-memo";
import type { CoverageSnoozeRow } from "~/types/coverage";
import type { SyncQueueRow } from "~/types/sync-queue";
import type { WearableObservation } from "~/types/wearable";

export class AnchorDB extends Dexie {
  daily_entries!: Table<DailyEntry, number>;
  weekly_assessments!: Table<WeeklyAssessment, number>;
  fortnightly_assessments!: Table<FortnightlyAssessment, number>;
  quarterly_reviews!: Table<QuarterlyReview, number>;
  labs!: Table<LabResult, number>;
  imaging!: Table<Imaging, number>;
  ctdna_results!: Table<CtdnaResult, number>;
  molecular_profile!: Table<MolecularProfile, number>;
  trials!: Table<Trial, number>;
  treatments!: Table<Treatment, number>;
  medications!: Table<Medication, number>;
  medication_events!: Table<MedicationEvent, number>;
  medication_prompt_events!: Table<MedicationPromptEvent, number>;
  change_signals!: Table<ChangeSignalRow, number>;
  signal_events!: Table<SignalEventRow, number>;
  care_team_contacts!: Table<CareTeamContact, number>;
  life_events!: Table<LifeEvent, number>;
  decisions!: Table<Decision, number>;
  zone_alerts!: Table<ZoneAlert, number>;
  family_notes!: Table<FamilyNote, number>;
  settings!: Table<Settings, number>;
  pending_results!: Table<PendingResult, number>;
  ingested_documents!: Table<IngestedDocument, number>;
  comprehensive_assessments!: Table<ComprehensiveAssessment, number>;
  treatment_cycles!: Table<TreatmentCycle, number>;
  patient_tasks!: Table<PatientTask, number>;
  agent_states!: Table<AgentStateRow, number>;
  log_events!: Table<LogEventRow, number>;
  agent_runs!: Table<AgentRunRow, number>;
  agent_feedback!: Table<AgentFeedbackRow, number>;
  // v23: multi-day follow-up loop. Each row is one question an agent
  // promised to revisit; the feed composer re-surfaces it when `due_at`
  // matures.
  agent_followups!: Table<AgentFollowUpRow, number>;
  appointments!: Table<Appointment, number>;
  appointment_links!: Table<AppointmentLink, number>;
  care_team!: Table<CareTeamMember, number>;
  timeline_media!: Table<TimelineMedia, number>;
  // v17: Legacy module tables.
  profile_entries!: Table<ProfileEntry, number>;
  profile_prompts!: Table<ProfilePrompt, number>;
  profile_aspects!: Table<ProfileAspect, number>;
  biographical_outline!: Table<BiographicalOutline, number>;
  memory_clusters!: Table<MemoryCluster, number>;
  profile_consent!: Table<ProfileConsent, number>;
  // v18: Nutrition module.
  foods!: Table<FoodItem, number>;
  meal_entries!: Table<MealEntry, number>;
  meal_items!: Table<MealItem, number>;
  // v19: Nutrition enhancements.
  fluid_logs!: Table<FluidLog, number>;
  meal_templates!: Table<MealTemplate, number>;
  // v20: Patient identity envelope (mirrors Supabase household_profile).
  household_profile!: Table<HouseholdProfileRow, string>;
  // v21: Records-import provenance.
  pdf_blobs!: Table<PdfBlob, number>;
  // v22: Voice memos. The patient's primary self-report channel; rows
  // carry transcript + metadata, while the audio Blob lives in
  // `timeline_media` (`owner_type: "voice_memo"`).
  voice_memos!: Table<VoiceMemo, number>;
  // v24: Analytical-layer foundation. Provisional signals carry detector
  // candidates that need a confirming reading before they fire as full
  // ChangeSignals; signal labels carry Thomas's post-clinic ground-truth
  // labels that supervise axis-attribution priors and calibration audit.
  provisional_signals!: Table<ProvisionalSignalRow, string>;
  signal_labels!: Table<SignalLabelRow, string>;
  // v25: Coverage-engine snoozes. Patient's dismiss action on a
  // coverage card writes a row here; the engine reads the table on
  // every feed compose and suppresses the matching field_key until
  // snoozed_until expires. Calm-engagement complement to the
  // detector itself.
  coverage_snoozes!: Table<CoverageSnoozeRow, number>;
  // v26: Persistent sync queue. Replaces the in-memory queue that was
  // losing Hu Lin's writes whenever bootstrap stalled (no household_id
  // → queue paused → tab close → pending ops vanished). Each row is
  // one push to `cloud_rows`; the worker drains in id order and deletes
  // the row on successful upsert. Survives tab close, browser restart,
  // and pre-household sign-in windows.
  sync_queue!: Table<SyncQueueRow, number>;
  // v27: Shadow rule-engine alerts. Same shape as `zone_alerts` but
  // populated by the V2 rule set during the analytical-layer rollout
  // (Sprint 2 Phase 2–5). The patient feed never reads from this
  // table — it's a Thomas-only diff surface so V2 can be tuned
  // against Hu Lin's actual history before the cutover. Intentionally
  // local-only; never mirrored to `cloud_rows`.
  zone_alerts_shadow!: Table<ZoneAlert, number>;
  // v28: Wearable observations from Health Connect (Oura, Withings,
  // Garmin, Samsung etc.). One row per (date, metric_id, source). Id
  // is deterministic (`source:metric:date`) so re-importing the same
  // observation is idempotent. Indexed on date + metric_id for the
  // analytical layer's hot query: "what did the wearable say about
  // metric X on day Y".
  wearable_observations!: Table<WearableObservation, string>;

  constructor() {
    super("anchor_db");
    this.version(1).stores({
      daily_entries: "++id, date, entered_by",
      weekly_assessments: "++id, week_start",
      fortnightly_assessments: "++id, assessment_date",
      quarterly_reviews: "++id, review_date",
      labs: "++id, date",
      imaging: "++id, date",
      ctdna_results: "++id, date",
      molecular_profile: "++id",
      trials: "++id, trial_id, status, priority",
      treatments: "++id, cycle_number, date",
      medications: "++id, start_date",
      life_events: "++id, event_date",
      decisions: "++id, decision_date",
      zone_alerts: "++id, triggered_at, rule_id, zone",
      family_notes: "++id, created_at",
      settings: "++id",
    });
    this.version(2).stores({
      pending_results: "++id, ordered_date, category, expected_by",
      ingested_documents: "++id, uploaded_at, status, kind",
    });
    this.version(3).stores({
      comprehensive_assessments:
        "++id, assessment_date, status, trigger, started_at",
    });
    this.version(4).stores({
      treatment_cycles:
        "++id, start_date, status, protocol_id, cycle_number",
    });
    this.version(5).stores({
      patient_tasks:
        "++id, due_date, active, category, schedule_kind, preset_id",
    });
    // v6: reshape medications table for logging-integrated module + add events.
    // The v1 medications table was unused; safe to redefine indexes.
    this.version(6).stores({
      medications:
        "++id, drug_id, category, active, cycle_id, source, started_on",
      medication_events:
        "++id, medication_id, drug_id, event_type, logged_at, [drug_id+logged_at]",
    });
    // v7: context-aware medication prompts (2b.1). The compound
    // [rule_id+fired_for] index dedupes a prompt within its trigger window so
    // the dashboard card never re-shows an acknowledged or dismissed prompt.
    this.version(7).stores({
      medication_prompt_events:
        "++id, rule_id, status, shown_at, drug_id, cycle_id, [rule_id+fired_for]",
    });
    // v8: change-signal detector outputs (slice 2). `fired_for` is the dedup
    // key per detector occurrence; `status` drives lifecycle (open →
    // acknowledged / dismissed / resolved). The compound [detector+fired_for]
    // index enforces uniqueness per occurrence.
    this.version(8).stores({
      change_signals:
        "++id, detector, fired_for, metric_id, axis, severity, status, detected_at, [detector+fired_for]",
    });
    // v9: per-signal event log for outcome attribution (slice 4). One row
    // per lifecycle transition or user-logged action. Index on signal_id so
    // the attribution helper can walk events for a given signal cheaply.
    this.version(9).stores({
      signal_events:
        "++id, signal_id, kind, action_ref_id, created_at, [signal_id+created_at]",
    });
    // v10: multi-agent super-brain (Sprint 2). The patient's "log" surface
    // writes to `log_events` directly (no per-log Claude call). Once daily
    // (or on-demand), each specialist runs over its referrals: the run
    // produces an `agent_runs` row with the daily report, and the
    // specialist's `agent_states` row is rewritten in place.
    // - agent_states: unique per agent_id, holds the living state.md
    // - log_events: raw inputs; sliced by tag at batch time
    // - agent_runs: one row per invocation, indexed for "latest report"
    this.version(10).stores({
      agent_states: "++id, &agent_id, updated_at",
      log_events: "++id, at",
      agent_runs: "++id, agent_id, ran_at, [agent_id+ran_at]",
    });
    // v11: dial-in loop. Per-run human feedback (Thomas, patient,
    // clinician). The next agent run reads the most recent feedback for
    // its agent_id and includes it as a cached system block, so the
    // agent can adjust tone, calibration, or scope.
    this.version(11).stores({
      agent_feedback:
        "++id, agent_id, run_id, by, kind, at, [agent_id+at]",
    });
    // v12: scheduling module. `appointments` is first-class for any
    // anticipated medical event; `appointment_links` is a directed
    // edge table so a blood test can be flagged as "prep_for" a chemo
    // consult. Indexes on starts_at / kind make range queries (month
    // grid, next-week) + kind-filter cheap. Compound
    // [kind+starts_at] lets "next scan" pull fast.
    this.version(12).stores({
      appointments:
        "++id, starts_at, kind, status, cycle_id, [kind+starts_at]",
      appointment_links:
        "++id, from_id, to_id, relation, [to_id+relation]",
    });
    // v13: care-team registry. One row per person involved in the
    // patient's care (family, clinicians, allied health). Consumed by
    // the appointment attendee chip picker, the emergency card, and
    // the pre-clinic summary. Indexed on role + is_lead so the
    // "primary oncologist" / "primary family contact" lookups are
    // cheap.
    this.version(13).stores({
      care_team: "++id, role, is_lead, name",
    });
    // v14: care-team touchpoint log (external-axis slice). Populates
    // the clinician-gap detector and renders a care-network view. Indexed
    // by date for fast "last contact" lookups. Distinct from `care_team`
    // (which is the roster of people) — this table is the event log of
    // when contact actually happened.
    this.version(14).stores({
      care_team_contacts:
        "++id, date, kind, follow_up_needed, follow_up_by",
    });
    // v15: index `appointments.ics_uid` so cycle-→-calendar sync can
    // dedupe in O(k) instead of scanning the whole table each cycle.
    // Same rows, new index — Dexie migrates in place.
    this.version(15).stores({
      appointments:
        "++id, starts_at, kind, status, cycle_id, ics_uid, [kind+starts_at]",
    });
    // v16: family timeline foundations. `timeline_media` is the single
    // blob store for photos / short video clips / voice memos attached
    // to a timeline-visible anchor (life event, family note, or
    // appointment). Composite [owner_type+owner_id] lets the timeline
    // renderer pull all media for one anchor in O(k); `taken_at` is
    // indexed so the chronological stream can merge blobs with events
    // without a table scan.
    //
    // `life_events` and `family_notes` gain optional columns (author,
    // created_via, is_memory, source_appointment_id on life events;
    // life_event_id and appointment_id on notes). These are additive —
    // Dexie only re-declares the stores whose *indexes* change, so we
    // re-state existing tables only where we want a new index, and
    // leave the rest to live as schemaless extra fields.
    this.version(16).stores({
      timeline_media:
        "++id, owner_type, owner_id, taken_at, created_at, [owner_type+owner_id]",
      life_events:
        "++id, event_date, category, is_memory, created_via, source_appointment_id",
      family_notes:
        "++id, created_at, life_event_id, appointment_id",
    });
    // v17: Legacy module. Six new tables drive the biographer's corpus
    // and the cadence engine that surfaces prompts. Indexes are chosen
    // so the biographer's hot paths (per-author, per-chapter, cluster
    // lookup, "next prompt for audience X") are all O(k) table scans.
    //
    // - profile_entries: the raw captures. Indexed by author for
    //   per-person threads, prompt_id for "answered?" joins, recorded_at
    //   for timeline joins, and memory_cluster_id for cluster render.
    // - profile_prompts: the seeded library. audience + asked_at lets
    //   the cadence engine pick an unseen prompt per person cheaply;
    //   pair_id clusters cross-audience prompts on the same theme.
    // - profile_aspects: derived character sketch facts with citations
    //   back to entries. Indexed by aspect + chapter.
    // - biographical_outline: Butler life-review outline. Sparse — one
    //   row per chapter/sub_chapter. arc_position drives sequencing.
    // - memory_clusters: cross-perspective memory aggregation. Indexed
    //   by seed_entry_id for "find my cluster" and approximate_date for
    //   chronological layering.
    // - profile_consent: singleton row (id=1). No secondary indexes.
    this.version(17).stores({
      profile_entries:
        "++id, author, kind, entry_mode, visibility, " +
        "relationship_dyad, memory_cluster_id, prompt_id, " +
        "recorded_at, [author+recorded_at]",
      profile_prompts:
        "++id, audience, depth, source, sensitivity, category, " +
        "pair_id, asked_at, [audience+asked_at]",
      profile_aspects:
        "++id, aspect, chapter, last_updated",
      biographical_outline:
        "++id, chapter, arc_position, target_depth, " +
        "[chapter+sub_chapter]",
      memory_clusters:
        "++id, seed_entry_id, created_by, approximate_date, created_at",
      profile_consent: "&id",
    });
    // v18: Nutrition module. Three tables drive food search, per-meal
    // line items, and a snapshot of meal-level totals.
    //
    // - foods: a searchable catalogue of foods with mPDAC/ keto flags.
    //   Indexed on `name` for prefix lookups, `category` for filtering,
    //   `keto_friendly` and `pdac_easy_digest` so the picker can show
    //   "good choices first" without scanning the whole table. `source`
    //   lets us segment seed vs. user vs. AI-generated rows for QA.
    // - meal_entries: one row per logged meal. `[date+meal_type]` is
    //   the hot index — the daily dashboard pulls all of today's
    //   meals, in meal-type order, in O(k).
    // - meal_items: line items inside a meal. Indexed on
    //   meal_entry_id for the obvious join; on food_id so "where have
    //   I eaten this before" lookups are cheap.
    this.version(18).stores({
      foods:
        "++id, name, name_zh, category, source, keto_friendly, " +
        "pdac_easy_digest, updated_at",
      meal_entries:
        "++id, date, meal_type, logged_at, source, " +
        "[date+meal_type]",
      meal_items:
        "++id, meal_entry_id, food_id, created_at",
    });
    // v19: Nutrition enhancements — hydration tracking + meal templates.
    //
    // - fluid_logs: one row per swallow event. Indexed by `date` for
    //   the daily total and `logged_at` for the day-clock view. The
    //   compound `[date+kind]` lets the dashboard slice "water vs.
    //   electrolyte vs. broth" cheaply for the 7-day trend.
    // - meal_templates: saved-meal definitions. Items are stored as a
    //   JSON-shaped property in the row (not a separate table) since
    //   templates are immutable snapshots. Indexed by `last_used_at`
    //   for the recent-templates list and `use_count` for "favourites".
    this.version(19).stores({
      fluid_logs:
        "++id, date, kind, logged_at, [date+kind]",
      meal_templates:
        "++id, name, meal_type, last_used_at, use_count, updated_at",
    });
    // v20: Patient identity envelope. Mirrors the Supabase
    // `household_profile` table so AI prompt templating has a local
    // source on offline-first devices. One row keyed by `household_id`
    // (string PK, not auto-increment) so the round-tripping with the
    // server stays trivial.
    this.version(20).stores({
      household_profile:
        "&household_id, updated_at",
    });
    // v21: patient-owned records import (step 2 of docs/RECORDS_IMPORT).
    // `pdf_blobs` stores the original PDF / CDA XML / image bytes a
    // clinical row was extracted from, so the "view original" affordance
    // on feed items resolves offline without re-uploading. Clinical rows
    // (labs, imaging, ctdna_results, decisions, life_events, medications,
    // treatments, treatment_cycles, appointments) gained nullable
    // `source_pdf_id` + `source_system` fields in their type definitions;
    // unindexed nullable columns do not require a Dexie migration, so
    // only the new table is declared here.
    this.version(21).stores({
      pdf_blobs: "++id, sha256, source_system, captured_at",
    });
    // v22: Voice memos. The patient records, Whisper transcribes, the
    // memo lands here. Indexed on `day` for the diary's per-day index,
    // `recorded_at` for chronological merge with other diary streams,
    // `log_event_id` for joining back to the agent fan-out a memo
    // triggered, and `audio_media_id` so the audio Blob lookup in
    // `timeline_media` is O(1).
    this.version(22).stores({
      voice_memos:
        "++id, recorded_at, day, log_event_id, audio_media_id, " +
        "source_screen, entered_by",
    });
    // v23: agent multi-day follow-up loop. One row per outstanding
    // question an agent promised to revisit. The feed composer reads
    // unresolved rows whose `due_at <= today`. Compound
    // [agent_id+question_key] supports the supersede path: when an
    // agent re-emits a follow-up with the same key, we resolve the
    // older row and add a fresh one. `due_at` is indexed because the
    // composer's hot query is "show me all matured, unresolved
    // follow-ups across all agents".
    this.version(23).stores({
      agent_followups:
        "++id, agent_id, question_key, due_at, asked_at, resolved_at, " +
        "[agent_id+question_key]",
    });
    // v24: Analytical-layer foundation. `provisional_signals` are
    // detector candidates whose change-point posterior is in the
    // confirm-but-not-fire band; the analytical layer prompts for a
    // corroborating reading and integrates the result. At most one
    // prompt-bearing row may be active at any time across the system
    // (the cap is enforced in code, not in schema). `signal_labels`
    // hold Thomas's post-clinic ground-truth labels — the supervision
    // signal that lets axis-attribution priors and detector calibration
    // tune themselves over time. See docs/ANALYTICAL_LAYER.md for the
    // design and tests/unit/analytical-* for the property-based tests.
    this.version(24).stores({
      provisional_signals:
        "&id, detector_id, metric_id, status, created_at, expires_at",
      signal_labels:
        "&id, signal_id, visit_date, label, applied_at",
    });
    // v25: Coverage-engine snoozes. One row per dismissed coverage
    // prompt; `snoozed_until` is an ISO YYYY-MM-DD that the detector
    // compares against today on every feed compose. Indexed on
    // field_key so the active-snooze query is O(unique fields), and
    // on snoozed_until so the periodic prune ("drop expired rows")
    // stays cheap.
    this.version(25).stores({
      coverage_snoozes:
        "++id, field_key, snoozed_until, snoozed_at",
    });
    // v26: Persistent sync queue. Each row is one pending push to
    // `cloud_rows`. Indexed on `enqueued_at` so the worker drains in
    // FIFO order and the diagnostic UI can show queue age.
    this.version(26).stores({
      sync_queue: "++id, table, kind, local_id, enqueued_at",
    });
    // v27: Shadow zone-alerts. Mirrors `zone_alerts` indexes so the
    // diff helpers can join the two tables on (rule_id, triggered_at)
    // cheaply. Local-only — explicitly NOT in SYNCED_TABLES.
    this.version(27).stores({
      zone_alerts_shadow: "++id, triggered_at, rule_id, zone",
    });
    // v28: Wearable observations from Health Connect. One row per
    // (date, metric_id, source_device); deterministic string id
    // makes re-imports idempotent. Indexes:
    //   - date           — quick "today's wearable readings" pull
    //   - metric_id      — quick "all RHR readings ever" pull
    //   - [date+metric_id] — analytical layer's hot lookup
    //   - source_device  — for vendor-attributed clinician views
    this.version(28).stores({
      wearable_observations:
        "&id, date, metric_id, source_device, recorded_at, " +
        "[date+metric_id]",
    });
  }
}

export const db = new AnchorDB();

// Historical alias for nowISO(). Kept for callers that already import
// `now` alongside `db` from this module — see ~/lib/utils/date.
export { nowISO as now } from "~/lib/utils/date";
