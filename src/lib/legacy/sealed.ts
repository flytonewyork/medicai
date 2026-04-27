import { db, now } from "~/lib/db/dexie";
import type { EnteredBy } from "~/types/clinical";
import type { ProfileEntry, ProfileEntryMode } from "~/types/legacy";

// Sealed entries cover three Tier-1 features that share a shape:
//
//   - Legacy letters (slice 17): the patient composes for a future
//     occasion (a child's 50th, a grandchild's 18th). Sealed until
//     date / event.
//   - Ethical will (slice 18): a generative Chinese / Jewish tradition
//     — values, hopes, blessings, apologies. Composed once, sealed
//     lightly, reviewed by the patient.
//   - Advent-calendar timed release (slice 19): a slow drip of
//     snippets queued for future delivery to specific recipients, each
//     with its own unlock date.
//
// All three are stored as ProfileEntry rows with a sealed flag in the
// tags array + structured metadata in the `summary` JSON column. A
// dedicated table would duplicate indexing; piggybacking on the
// existing corpus keeps the biographer's curation logic uniform.
//
// Recipient model: `household_members_mentioned` is reused as
// "addressed to" — the biographer views these rows differently (as
// bequests) than generic observational entries because of the sealed
// tag.

export interface SealedMetadata {
  kind: "legacy_letter" | "ethical_will" | "advent_snippet";
  unlock_date?: string;       // ISO date; first allowed opening day
  unlock_event?: string;      // free-text ("Thomas's 50th birthday")
  recipients: EnteredBy[];    // household members the content is for
  recipient_names?: string[]; // for future recipients (grandchildren)
  opened_at?: string;         // set when first unlocked
  opened_by?: EnteredBy;
}

export const SEALED_TAG = "__sealed__";

export interface CreateSealedInput {
  metadata: SealedMetadata;
  body: string;
  language: "en" | "zh" | "mixed";
  author: EnteredBy;
  entry_mode?: ProfileEntryMode;
  title?: string;
}

export async function createSealedEntry(
  input: CreateSealedInput,
): Promise<number> {
  const createdAt = now();
  const row: ProfileEntry = {
    kind: "story",
    language: input.language,
    recorded_at: createdAt,
    author: input.author,
    entry_mode: input.entry_mode ?? "first_person_subject",
    // Sealed entries are never family-visible until unlocked — the UI
    // flips this to "family" at unlock time if the author wanted that.
    visibility: "private",
    propagate: false,
    tags: [SEALED_TAG, input.metadata.kind],
    title: input.title,
    summary: JSON.stringify(input.metadata),
    transcript: input.body,
    household_members_mentioned: input.metadata.recipients,
    private_to_author: true,
    created_at: createdAt,
    updated_at: createdAt,
  };
  return (await db.profile_entries.add(row)) as number;
}

/** Is this entry eligible to open today? */
export function isUnlocked(
  entry: ProfileEntry,
  todayISO: string,
): boolean {
  const md = readMetadata(entry);
  if (!md) return false;
  if (md.opened_at) return true;
  if (md.unlock_date && todayISO >= md.unlock_date) return true;
  return false;
}

export function readMetadata(entry: ProfileEntry): SealedMetadata | null {
  if (!entry.tags.includes(SEALED_TAG)) return null;
  if (!entry.summary) return null;
  try {
    return JSON.parse(entry.summary) as SealedMetadata;
  } catch {
    return null;
  }
}

export async function openSealed(
  entryId: number,
  opener: EnteredBy,
  todayISO: string,
): Promise<{ ok: true; metadata: SealedMetadata } | { ok: false; reason: string }> {
  const entry = await db.profile_entries.get(entryId);
  if (!entry) return { ok: false, reason: "entry not found" };
  const md = readMetadata(entry);
  if (!md) return { ok: false, reason: "entry is not sealed" };
  if (!md.recipients.includes(opener)) {
    return { ok: false, reason: "not a listed recipient" };
  }
  if (!isUnlocked(entry, todayISO)) {
    return { ok: false, reason: "not yet unlocked" };
  }
  if (!md.opened_at) {
    const updated: SealedMetadata = {
      ...md,
      opened_at: now(),
      opened_by: opener,
    };
    await db.profile_entries.update(entryId, {
      summary: JSON.stringify(updated),
      // Open flips visibility to the recipients so the sealed letter
      // renders in the legacy view after unlock. Private-to-author
      // flag is cleared.
      visibility: "author_and_hulin",
      private_to_author: false,
      updated_at: now(),
    });
    return { ok: true, metadata: updated };
  }
  return { ok: true, metadata: md };
}

/** All sealed entries addressed to `recipient`, in chronological order. */
export async function listSealedForRecipient(
  recipient: EnteredBy,
): Promise<ProfileEntry[]> {
  const rows = await db.profile_entries
    .where("author")
    .notEqual("")
    .toArray();
  return rows
    .filter((e) => {
      const md = readMetadata(e);
      return md?.recipients.includes(recipient) ?? false;
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Sealed entries that become unlockable today for any recipient. */
export async function listNewlyUnlockable(
  todayISO: string,
): Promise<ProfileEntry[]> {
  const rows = await db.profile_entries.toArray();
  return rows.filter((e) => {
    const md = readMetadata(e);
    if (!md) return false;
    if (md.opened_at) return false;
    return isUnlocked(e, todayISO);
  });
}
