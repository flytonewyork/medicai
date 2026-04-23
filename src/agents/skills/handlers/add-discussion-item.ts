import { db } from "~/lib/db/dexie";
import { addDiscussionItem } from "~/lib/appointments/discussion-items";

export interface AddDiscussionItemInput {
  appointment_id: number;
  text: string;
}

export interface AddDiscussionItemOutput {
  ok: boolean;
  duplicate?: boolean;
  appointment_id: number;
  text?: string;
  error?: string;
}

export async function addDiscussionItemHandler(
  input: AddDiscussionItemInput,
): Promise<AddDiscussionItemOutput> {
  const appt = await db.appointments.get(input.appointment_id);
  if (!appt?.id) {
    return {
      ok: false,
      appointment_id: input.appointment_id,
      error: "appointment_not_found",
    };
  }
  // Don't emit duplicates — agents rerun, and we don't want the same
  // sentence queued five times. Trim + case-insensitive match.
  const normalised = input.text.trim();
  if (
    (appt.discussion_items ?? []).some(
      (d) =>
        d.text.trim().toLowerCase() === normalised.toLowerCase() &&
        !d.resolved_at,
    )
  ) {
    return {
      ok: true,
      duplicate: true,
      appointment_id: input.appointment_id,
      text: normalised,
    };
  }
  await addDiscussionItem(input.appointment_id, {
    text: normalised,
    source: "agent",
  });
  return {
    ok: true,
    duplicate: false,
    appointment_id: input.appointment_id,
    text: normalised,
  };
}
