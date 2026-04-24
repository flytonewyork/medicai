import { db, now } from "~/lib/db/dexie";
import type { EnteredBy, FamilyNote } from "~/types/clinical";
import type { TimelineMedia, TimelineMediaOwnerType } from "~/types/timeline";

// Threading helpers: every timeline anchor (life_event, appointment,
// family_note itself) can carry media and notes. These helpers centralise
// the FK shape so UI consumers don't care which kind of anchor they're
// showing — they ask for "the media and notes on this row," get both,
// render them.
//
// Slice 7 design note: we do NOT eagerly synthesise a life_events row
// for every attended appointment. The timeline renderer uses the
// appointment directly as the spine. A life_event is created only when
// the family wants to title / narrate / memorialise an event — see
// `promoteAppointmentToLifeEvent` below.

export type AnchorType = "life_event" | "appointment" | "family_note";

export interface Anchor {
  type: AnchorType;
  id: number;
}

export interface AnchorThread {
  media: TimelineMedia[];
  notes: FamilyNote[];
}

export async function listThreadForAnchor(
  anchor: Anchor,
): Promise<AnchorThread> {
  const [media, notes] = await Promise.all([
    anchor.type === "life_event" ||
    anchor.type === "family_note" ||
    anchor.type === "appointment"
      ? mediaForAnchor(anchor)
      : Promise.resolve([]),
    notesForAnchor(anchor),
  ]);
  return { media, notes };
}

async function mediaForAnchor(anchor: Anchor): Promise<TimelineMedia[]> {
  const ownerType = anchor.type as TimelineMediaOwnerType;
  const rows = await db.timeline_media
    .where("[owner_type+owner_id]")
    .equals([ownerType, anchor.id])
    .toArray();
  return rows.sort((a, b) => {
    const ka = a.taken_at ?? a.created_at;
    const kb = b.taken_at ?? b.created_at;
    return ka.localeCompare(kb);
  });
}

async function notesForAnchor(anchor: Anchor): Promise<FamilyNote[]> {
  if (anchor.type === "life_event") {
    return db.family_notes
      .where("life_event_id")
      .equals(anchor.id)
      .sortBy("created_at");
  }
  if (anchor.type === "appointment") {
    return db.family_notes
      .where("appointment_id")
      .equals(anchor.id)
      .sortBy("created_at");
  }
  return [];
}

export interface AddNoteInput {
  author: EnteredBy;
  body: string;
  anchor: Anchor;
}

export async function addNoteToAnchor(input: AddNoteInput): Promise<number> {
  const createdAt = now();
  const row: FamilyNote = {
    author: input.author,
    body: input.body,
    created_at: createdAt,
    updated_at: createdAt,
    life_event_id:
      input.anchor.type === "life_event" ? input.anchor.id : undefined,
    appointment_id:
      input.anchor.type === "appointment" ? input.anchor.id : undefined,
  };
  const id = await db.family_notes.add(row);
  return id as number;
}

/**
 * Promote an attended appointment into a first-class life_events row —
 * the user wants to title, narrate, or share it as a family memory.
 * Idempotent: if a life_event already references this appointment, the
 * existing id is returned.
 */
export async function promoteAppointmentToLifeEvent(
  appointmentId: number,
  author: EnteredBy,
  title?: string,
): Promise<number> {
  const existing = await db.life_events
    .where("source_appointment_id")
    .equals(appointmentId)
    .first();
  if (existing?.id != null) return existing.id;

  const appt = await db.appointments.get(appointmentId);
  if (!appt) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }
  const createdAt = now();
  const eventDate = appt.starts_at.slice(0, 10);
  const id = (await db.life_events.add({
    title: title ?? appt.title,
    event_date: eventDate,
    category: "medical",
    is_memory: true,
    author,
    created_via: "auto_appointment",
    source_appointment_id: appointmentId,
    created_at: createdAt,
    updated_at: createdAt,
  })) as number;
  return id;
}
