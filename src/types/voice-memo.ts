import type { Locale, EnteredBy } from "./clinical";

// A persisted voice memo. The audio Blob lives in `timeline_media`
// (`owner_type: "voice_memo"`) so it shares the existing photo/video
// blob store; the row here carries everything else — transcript,
// duration, attribution, and an optional path to the cloud-stored
// copy in Supabase Storage.
//
// Voice memos are the patient's primary self-report channel alongside
// the daily form and free-text logs. Every memo gets surfaced in the
// /diary timeline grouped by `day` (YYYY-MM-DD). When a memo also
// drove an agent fan-out (e.g. it was captured from /log), `log_event_id`
// links the two so the diary can show what the agents made of it.

export interface VoiceMemo {
  id?: number;
  recorded_at: string;
  // Denormalised local-time date (YYYY-MM-DD) for the diary's per-day
  // index. Computed from `recorded_at` at insert time so the diary can
  // group without a JS-side date conversion per row.
  day: string;
  duration_ms: number;
  transcript: string;
  locale: Locale;
  // Local Dexie row id in `timeline_media` carrying the audio Blob.
  audio_media_id?: number;
  // Supabase Storage path once the audio is mirrored to the cloud.
  // Empty until the upload succeeds; retried by the audio sync loop.
  audio_path?: string;
  audio_mime: string;
  audio_size_bytes: number;
  // Set when /log captured the memo and routed it through agent fan-out.
  // Lets the diary show the resulting agent reports inline with the memo.
  log_event_id?: number;
  source_screen?: "log" | "meal_ingest" | "phone_note" | "diary";
  entered_by: EnteredBy;
  // Filled by Slice 2 — Claude extracts daily-form fields (energy,
  // sleep, pain, mood, symptoms, foods) from the transcript and merges
  // them into daily_entries. Kept open-ended for now.
  parsed_fields?: VoiceMemoParsedFields;
  created_at: string;
  updated_at: string;
}

export interface VoiceMemoParsedFields {
  // ----- Daily-tracking flat fields (Slice 2) -----
  // Subjective 0–10 scales matching DailyEntry. Only set when the
  // patient verbalises a number or a clear qualitative anchor we can
  // map (e.g. "no pain at all" → 0, "really tired" → ~3 energy).
  energy?: number;
  sleep_quality?: number;
  appetite?: number;
  pain_current?: number;
  pain_worst?: number;
  mood_clarity?: number;
  nausea?: number;
  fatigue?: number;
  anorexia?: number;
  abdominal_pain?: number;
  // CTCAE 0–4 neuropathy. Inferred from descriptions like "tingling
  // when I touch cold things" → 1, "interferes with buttoning shirt"
  // → 2.
  neuropathy_hands?: number;
  neuropathy_feet?: number;
  // Concrete objective values when the patient states them.
  weight_kg?: number;
  diarrhoea_count?: number;
  // Booleans only flip true when the patient clearly reports the
  // symptom. We never invert a previously-true daily-entry boolean
  // back to false from a memo that's silent on it.
  cold_dysaesthesia?: boolean;
  mouth_sores?: boolean;
  fever?: boolean;
  // Free-form catch-all the Claude parser uses for one-off observations
  // (a taste change, a food recalled, anything that didn't fit a
  // structured field). Stays at top level so existing rows keep working.
  notes?: string;

  // ----- Slice 3: clinical content from clinic visits + scheduling -----
  // Set by the server-side Claude parser when the transcript discusses
  // a clinical event. These flow into `life_events`, `appointments`,
  // etc. through the apply step (audited in `applied_patches`).
  clinical?: VoiceMemoClinicalParse;

  // ----- Slice 3: personal content (LOCAL ONLY — never synced) -----
  // Filled by the on-device heuristic parser. The sync hook strips
  // this field from the cloud_rows payload so personal content never
  // leaves the device. Family interactions, food eaten, practice
  // notes, mood narrative, goals — kept private to the recording
  // device unless the patient explicitly promotes a detail elsewhere.
  personal?: VoiceMemoPersonalParse;

  // ----- Slice 3: audit trail of what got written -----
  // Each row is one Dexie patch this memo applied (which table, which
  // field, which value). The /memos detail view renders this so the
  // patient can see exactly which forms the AI updated for them.
  applied_patches?: AppliedPatch[];

  // ----- Slice 4: imaging + lab results the patient mentioned -----
  // Surfaced as preview chips. NOT auto-filed into /imaging or /labs
  // — those tables have stricter schemas. Stays on the memo only.
  imaging_results?: Array<{
    modality: "pet" | "ct" | "mri" | "ultrasound" | "xray" | "bone_scan" | "other";
    finding_summary: string;
    status: "clear" | "stable" | "improvement" | "progression" | "unclear";
    date?: string;
  }>;
  lab_results?: Array<{
    name: string;
    value?: string;
    status: "normal" | "raised" | "low" | "abnormal" | "unstated";
    date?: string;
  }>;

  // ----- Slice 4: dialogue-vibe follow-up questions -----
  // 0–2 short questions Claude would ask if it were a thoughtful
  // nurse / dietician / physio reading the memo. Surfaced under the
  // preview; each one offers a "Record answer" affordance that opens
  // the diary recorder.
  follow_up_questions?: string[];

  // Confidence in the overall parse. Only `high` triggers daily_entries
  // safe-fill; any value still appears on the memo card so the patient
  // can verify and correct.
  confidence: "low" | "medium" | "high";
}

export interface VoiceMemoClinicalParse {
  // The patient describing a clinic visit they just had. Captured as
  // a `life_events` row (category = medical, is_memory = false) so the
  // diary timeline picks it up.
  clinic_visit?: {
    visit_date?: string;        // ISO date — defaults to memo's recorded_at day
    provider?: string;          // "A/Prof Sumitra Ananda" / "Sumi" / "苏米"
    location?: string;
    summary: string;            // 1–3 sentences of what happened
    key_points?: string[];      // bulleted decisions / instructions
  };
  // The patient mentioning a scheduled appointment. One row per
  // distinct appointment — repeated mentions of the same appointment
  // collapse into one. Goes into the `appointments` table when the
  // date+title look concrete; otherwise stays as a memo-only note.
  appointments_mentioned?: Array<{
    title: string;
    starts_at?: string;         // ISO datetime when stated
    location?: string;
    doctor?: string;
    prep?: string;              // "fasting 6 hours", "bring imaging CDs"
    kind?: "clinic" | "chemo" | "scan" | "blood_test" | "procedure" | "other";
    confidence: "low" | "medium" | "high";
  }>;
  // Treatments / medications the patient brought up. We don't auto-
  // file medication_events here — adherence has its own surface — but
  // the diary card surfaces what was discussed.
  medications_mentioned?: Array<{
    name: string;               // "Creon" / "gemcitabine" / "abraxane"
    detail?: string;            // "took with lunch", "skipped dinner dose"
  }>;
}

export interface VoiceMemoPersonalParse {
  // Everything the on-device heuristic extractor recognises. None of
  // these fields fan out to any other Dexie table — they live on the
  // memo for the patient's own diary review.
  food_mentions?: string[];     // free phrases — "two boiled eggs", "soup"
  family_mentions?: string[];   // "called mum", "Catherine visited"
  practice_mentions?: string[]; // "qigong this morning", "20 min meditation"
  goals?: string[];             // "tomorrow I'll walk to the corner"
  mood_narrative?: string;      // first sentence after "felt" / "感觉"
  observations?: string;        // anything left over the heuristic kept
}

export interface AppliedPatch {
  // Which Dexie table the memo wrote to.
  table:
    | "daily_entries"
    | "life_events"
    | "appointments"
    | "imaging"
    | "labs";
  // The local id of the row written or updated.
  row_id: number;
  // Fields touched on that row, with the value the memo supplied. We
  // store the value (not just the field name) so the audit view shows
  // exactly what the AI heard.
  fields: Record<string, string | number | boolean | null>;
  // For `update` patches: what the row had at the touched keys before
  // the memo wrote to them. Lets Undo restore the prior state without
  // having to know upfront which call modified which key. Empty for
  // safe-fill patches (since safe-fill only writes to undefined keys),
  // but we still record explicit `undefined` markers so undo can drop
  // the keys cleanly.
  prior_fields?: Record<string, string | number | boolean | null>;
  // "create" when this memo created the row; "update" when it merged
  // into an existing row.
  op: "create" | "update";
  applied_at: string;
  // Set true after the patient taps Undo. We never delete the entry —
  // keeping the audit trail intact lets the patient see "this got
  // logged then undone" rather than have it silently disappear.
  undone_at?: string;
}
