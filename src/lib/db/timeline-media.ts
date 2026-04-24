import { db, now } from "./dexie";
import type {
  TimelineMedia,
  TimelineMediaKind,
  TimelineMediaOwnerType,
} from "~/types/timeline";
import type { CapturedMedia } from "~/types/capture";
import type { EnteredBy } from "~/types/clinical";

// DB helpers for `timeline_media`. The capture pipeline produces a
// CapturedMedia; this module attaches it to a timeline-visible anchor
// (life event, family note, or — once v17 ships — a profile entry).
//
// Returning the new row's id lets UI callers chain to a preview or a
// detail route without a follow-up query.

export interface AttachMediaInput {
  owner_type: TimelineMediaOwnerType;
  owner_id: number;
  captured: CapturedMedia;
  created_by: EnteredBy;
  caption?: string;
}

export async function attachMedia(input: AttachMediaInput): Promise<number> {
  const { owner_type, owner_id, captured, created_by, caption } = input;
  const created_at = now();
  const base = {
    owner_type,
    owner_id,
    mime_type: captured.mime_type,
    caption,
    created_at,
    created_by,
  };
  const row: TimelineMedia = buildRow(base, captured);
  const id = await db.timeline_media.add(row);
  return id;
}

function buildRow(
  base: {
    owner_type: TimelineMediaOwnerType;
    owner_id: number;
    mime_type: string;
    caption?: string;
    created_at: string;
    created_by: EnteredBy;
  },
  captured: CapturedMedia,
): TimelineMedia {
  if (captured.kind === "photo") {
    return {
      ...base,
      kind: "photo",
      blob: captured.blob,
      width: captured.width,
      height: captured.height,
      taken_at: captured.taken_at,
    };
  }
  if (captured.kind === "video") {
    return {
      ...base,
      kind: "video",
      blob: captured.blob,
      thumbnail_blob: captured.thumbnail_blob,
      width: captured.width,
      height: captured.height,
      duration_ms: captured.duration_ms,
    };
  }
  return {
    ...base,
    kind: "voice",
    blob: captured.blob,
    duration_ms: captured.duration_ms,
  };
}

/** All media attached to one anchor, ordered by taken_at then created_at. */
export async function listMediaForOwner(
  owner_type: TimelineMediaOwnerType,
  owner_id: number,
): Promise<TimelineMedia[]> {
  const rows = await db.timeline_media
    .where("[owner_type+owner_id]")
    .equals([owner_type, owner_id])
    .toArray();
  return rows.sort((a, b) => {
    const ka = a.taken_at ?? a.created_at;
    const kb = b.taken_at ?? b.created_at;
    return ka.localeCompare(kb);
  });
}

/** All media of a given kind, ordered by created_at desc. */
export async function listMediaByKind(
  kind: TimelineMediaKind,
  limit = 50,
): Promise<TimelineMedia[]> {
  // Dexie's orderBy skips rows without the indexed value, so we can't
  // order by taken_at (optional). created_at is always set at write time.
  const rows = await db.timeline_media
    .orderBy("created_at")
    .reverse()
    .filter((m) => m.kind === kind)
    .limit(limit)
    .toArray();
  return rows;
}

export async function deleteMedia(id: number): Promise<void> {
  await db.timeline_media.delete(id);
}

/** Remove every media row for an anchor — used when the anchor is deleted. */
export async function deleteMediaForOwner(
  owner_type: TimelineMediaOwnerType,
  owner_id: number,
): Promise<number> {
  return db.timeline_media
    .where("[owner_type+owner_id]")
    .equals([owner_type, owner_id])
    .delete();
}
