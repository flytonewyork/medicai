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
  energy?: number;
  sleep_hours?: number;
  pain?: number;
  mood?: number;
  symptoms?: string[];
  notes?: string;
}
