import { db, now } from "~/lib/db/dexie";
import type { Locale, EnteredBy } from "~/types/clinical";
import type { VoiceMemo } from "~/types/voice-memo";
import type { TimelineMedia } from "~/types/timeline";
import { localDayISO } from "~/lib/utils/date";

// Persist a voice memo so the diary timeline can show it later. The
// audio Blob goes into `timeline_media` under owner_type "voice_memo";
// the row in `voice_memos` carries the transcript + metadata + a
// pointer back to that Blob. Both writes happen in a single Dexie
// transaction so a failure leaves nothing half-saved.
//
// Cloud-side: the `voice_memos` row syncs through the existing Dexie
// hook → cloud_rows queue. The audio Blob doesn't — it goes through
// a separate Supabase Storage upload (see ./cloud.ts) which also
// stamps `audio_path` back onto the row when the upload succeeds.

export interface PersistVoiceMemoInput {
  blob: Blob;
  mime: string;
  duration_ms: number;
  transcript: string;
  locale: Locale;
  entered_by: EnteredBy;
  source_screen?: VoiceMemo["source_screen"];
  log_event_id?: number;
  recorded_at?: string;
}

export interface PersistVoiceMemoResult {
  memo_id: number;
  audio_media_id: number;
}

export async function persistVoiceMemo(
  input: PersistVoiceMemoInput,
): Promise<PersistVoiceMemoResult> {
  const recordedAt = input.recorded_at ?? now();
  const day = localDayISO(recordedAt);
  const created = now();
  const size = input.blob.size;

  return db.transaction(
    "rw",
    db.voice_memos,
    db.timeline_media,
    async () => {
      // Insert the memo first with no media link, then attach the
      // media row, then patch the memo. We need the memo id as the
      // timeline_media owner_id, and the media id as the memo's
      // `audio_media_id`. Two-phase insert keeps both pointers right.
      const memoId = (await db.voice_memos.add({
        recorded_at: recordedAt,
        day,
        duration_ms: input.duration_ms,
        transcript: input.transcript,
        locale: input.locale,
        audio_mime: input.mime,
        audio_size_bytes: size,
        log_event_id: input.log_event_id,
        source_screen: input.source_screen,
        entered_by: input.entered_by,
        created_at: created,
        updated_at: created,
      })) as number;

      const media: TimelineMedia = {
        owner_type: "voice_memo",
        owner_id: memoId,
        kind: "voice",
        blob: input.blob,
        mime_type: input.mime,
        duration_ms: input.duration_ms,
        taken_at: recordedAt,
        created_at: created,
        created_by: input.entered_by,
      };
      const audio_media_id = (await db.timeline_media.add(media)) as number;

      await db.voice_memos.update(memoId, {
        audio_media_id,
        updated_at: now(),
      });

      return { memo_id: memoId, audio_media_id };
    },
  );
}

// Slice 8: text-only memo persistence. /log accepts typed entries
// alongside voice; the typed path needs a memo row but no audio
// blob. Same shape as persistVoiceMemo minus the timeline_media
// write. parseVoiceMemo runs the same way once the row's in.
export interface PersistTextMemoInput {
  transcript: string;
  locale: Locale;
  entered_by: EnteredBy;
  source_screen?: VoiceMemo["source_screen"];
  recorded_at?: string;
}

export async function persistTextMemo(
  input: PersistTextMemoInput,
): Promise<{ memo_id: number }> {
  const recordedAt = input.recorded_at ?? now();
  const day = localDayISO(recordedAt);
  const created = now();
  const memoId = (await db.voice_memos.add({
    recorded_at: recordedAt,
    day,
    duration_ms: 0,
    transcript: input.transcript,
    locale: input.locale,
    audio_mime: "text/plain",
    audio_size_bytes: 0,
    source_screen: input.source_screen,
    entered_by: input.entered_by,
    created_at: created,
    updated_at: created,
  })) as number;
  return { memo_id: memoId };
}
