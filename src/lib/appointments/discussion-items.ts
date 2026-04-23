import { db, now } from "~/lib/db/dexie";
import type { AppointmentDiscussionItem } from "~/types/appointment";

// Append a discussion item to an appointment. Used by the /log direct-file
// follow-ups ("Add to next clinic") and any agent that decides something
// should be raised at a future visit.

export async function addDiscussionItem(
  appointmentId: number,
  item: Omit<AppointmentDiscussionItem, "id" | "added_at"> & {
    id?: string;
    added_at?: string;
  },
): Promise<void> {
  const appt = await db.appointments.get(appointmentId);
  if (!appt) return;
  const next: AppointmentDiscussionItem = {
    id:
      item.id ??
      Math.random().toString(36).slice(2, 10) +
        "-" +
        Date.now().toString(36),
    text: item.text,
    source: item.source,
    source_ref: item.source_ref,
    added_at: item.added_at ?? now(),
    resolved_at: item.resolved_at,
  };
  const list = appt.discussion_items ?? [];
  await db.appointments.update(appointmentId, {
    discussion_items: [...list, next],
    updated_at: now(),
  });
}

export async function toggleDiscussionItemResolved(
  appointmentId: number,
  itemId: string,
): Promise<void> {
  const appt = await db.appointments.get(appointmentId);
  if (!appt) return;
  const ts = now();
  const next = (appt.discussion_items ?? []).map((d) =>
    d.id === itemId
      ? { ...d, resolved_at: d.resolved_at ? undefined : ts }
      : d,
  );
  await db.appointments.update(appointmentId, {
    discussion_items: next,
    updated_at: ts,
  });
}

export async function removeDiscussionItem(
  appointmentId: number,
  itemId: string,
): Promise<void> {
  const appt = await db.appointments.get(appointmentId);
  if (!appt) return;
  const next = (appt.discussion_items ?? []).filter((d) => d.id !== itemId);
  await db.appointments.update(appointmentId, {
    discussion_items: next,
    updated_at: now(),
  });
}
