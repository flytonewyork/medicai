import { db, now } from "~/lib/db/dexie";
import { getSupabaseBrowser } from "~/lib/supabase/client";
import {
  getCachedHouseholdId,
  refreshHouseholdId,
} from "~/lib/sync/household-context";

// Cloud mirror for voice-memo audio. The metadata row in `voice_memos`
// already syncs through the cloud_rows queue; this module handles the
// audio Blob, which is too big to embed in a JSON column. Blobs go to
// a Supabase Storage bucket called `voice-memos` under
// `{household_id}/{memo_id}-{ts}.{ext}`. Once the upload succeeds we
// stamp `audio_path` onto the memo so the diary can fetch it on any
// device that doesn't have the local Blob.
//
// Failure mode is offline-friendly: the local Blob in `timeline_media`
// remains usable for playback, and `syncPendingVoiceMemoAudio()` retries
// on the next online window. We never block the UI on the upload.

const BUCKET = "voice-memos";

export async function uploadVoiceMemoAudio(memoId: number): Promise<void> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo || memo.audio_path) return;
  if (!memo.audio_media_id) return;

  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  let householdId = getCachedHouseholdId();
  if (!householdId) householdId = await refreshHouseholdId();
  if (!householdId) return;

  const media = await db.timeline_media.get(memo.audio_media_id);
  if (!media) return;

  const ext = mimeToExt(memo.audio_mime);
  const path = `${householdId}/${memo.id}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: memo.audio_mime,
    upsert: false,
  });
  if (error) throw error;

  await db.voice_memos.update(memoId, {
    audio_path: path,
    updated_at: now(),
  });
}

// Best-effort sweep over memos whose audio hasn't reached the cloud yet.
// Called on app boot and after sign-in. Errors are logged but never
// thrown — a failed upload is a "try again later", not a UI problem.
export async function syncPendingVoiceMemoAudio(): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;

  // Voice memos are sparse (a few per day, not thousands), so a full
  // table scan filtered in JS is fine and saves us a dedicated index.
  const all = await db.voice_memos.toArray();
  for (const m of all) {
    if (m.audio_path) continue;
    if (!m.id || !m.audio_media_id) continue;
    try {
      await uploadVoiceMemoAudio(m.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[voice-memo] cloud upload retry failed", m.id, err);
    }
  }
}

// Resolve a playable URL for a memo. Prefers the local Blob if present
// (instant + offline-safe); falls back to a short-lived signed URL from
// Supabase Storage when the memo has only a cloud path. Returns null
// when neither is available.
export async function resolveVoiceMemoAudioUrl(
  memoId: number,
): Promise<{ url: string; revoke?: () => void } | null> {
  const memo = await db.voice_memos.get(memoId);
  if (!memo) return null;

  if (memo.audio_media_id) {
    const media = await db.timeline_media.get(memo.audio_media_id);
    if (media?.blob) {
      const url = URL.createObjectURL(media.blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    }
  }

  if (memo.audio_path) {
    const supabase = getSupabaseBrowser();
    if (!supabase) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(memo.audio_path, 60 * 10);
    if (error || !data?.signedUrl) return null;
    return { url: data.signedUrl };
  }

  return null;
}

function mimeToExt(mime: string): string {
  const base = mime.split(";")[0]?.trim();
  switch (base) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "m4a";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "webm";
  }
}
