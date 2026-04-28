import type { EnteredBy } from "./clinical";

// Owner of a media blob. Media is attached to a timeline-visible anchor:
// a life event (family moment), a family note (commentary), an
// appointment (clinical milestone), a profile entry (Legacy module:
// the biographer's corpus), or a voice memo (v22, the patient's
// primary self-report channel into the diary timeline).
export type TimelineMediaOwnerType =
  | "life_event"
  | "family_note"
  | "appointment"
  | "profile_entry"
  | "voice_memo";

export type TimelineMediaKind = "photo" | "video" | "voice";

export interface TimelineMedia {
  id?: number;
  owner_type: TimelineMediaOwnerType;
  owner_id: number;
  kind: TimelineMediaKind;
  // Raw media, stored locally in IndexedDB. Per product decision, video
  // clips are capped at 10s at capture time; enforcement lives in the
  // capture layer, not the schema.
  blob: Blob;
  thumbnail_blob?: Blob;             // small JPEG for list rendering
  mime_type: string;
  width?: number;
  height?: number;
  duration_ms?: number;              // voice + video only
  caption?: string;
  taken_at?: string;                 // EXIF-derived when available
  created_at: string;
  created_by: EnteredBy;
}
