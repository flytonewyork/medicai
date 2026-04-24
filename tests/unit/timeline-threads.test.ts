import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  addNoteToAnchor,
  listThreadForAnchor,
  promoteAppointmentToLifeEvent,
} from "~/lib/timeline/threads";
import { attachMedia } from "~/lib/db/timeline-media";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function photo() {
  return {
    kind: "photo" as const,
    blob: new Blob([new Uint8Array(16)], { type: "image/jpeg" }),
    mime_type: "image/jpeg",
    width: 640,
    height: 480,
  };
}

describe("listThreadForAnchor", () => {
  it("returns media + notes for a life_event anchor", async () => {
    const leId = (await db.life_events.add({
      title: "beach day",
      event_date: "2026-03-01",
      category: "family",
      created_at: "now",
      updated_at: "now",
    })) as number;

    await attachMedia({
      owner_type: "life_event",
      owner_id: leId,
      captured: photo(),
      created_by: "catherine",
    });
    await addNoteToAnchor({
      author: "thomas",
      body: "Dad's laugh at the sandcastles was the best part.",
      anchor: { type: "life_event", id: leId },
    });

    const thread = await listThreadForAnchor({ type: "life_event", id: leId });
    expect(thread.media).toHaveLength(1);
    expect(thread.notes).toHaveLength(1);
    expect(thread.notes[0]?.body).toContain("sandcastles");
  });

  it("returns notes threaded onto an appointment anchor", async () => {
    const apptId = (await db.appointments.add({
      title: "Cycle 4 Day 1",
      starts_at: "2026-02-10T09:00:00+11:00",
      kind: "chemo",
      status: "attended",
      created_at: "2026-02-10T09:00:00+11:00",
      updated_at: "2026-02-10T09:00:00+11:00",
    })) as number;

    await addNoteToAnchor({
      author: "catherine",
      body: "Dad brought the orchid book today. Read for an hour.",
      anchor: { type: "appointment", id: apptId },
    });

    const thread = await listThreadForAnchor({
      type: "appointment",
      id: apptId,
    });
    expect(thread.notes).toHaveLength(1);
    expect(thread.notes[0]?.body).toContain("orchid");
  });
});

describe("promoteAppointmentToLifeEvent", () => {
  it("creates a life_event referencing the appointment on first call", async () => {
    const apptId = (await db.appointments.add({
      title: "Cycle 4 Day 1",
      starts_at: "2026-02-10T09:00:00+11:00",
      kind: "chemo",
      status: "attended",
      created_at: "2026-02-10T09:00:00+11:00",
      updated_at: "2026-02-10T09:00:00+11:00",
    })) as number;

    const leId = await promoteAppointmentToLifeEvent(apptId, "thomas");
    const le = await db.life_events.get(leId);
    expect(le?.category).toBe("medical");
    expect(le?.is_memory).toBe(true);
    expect(le?.created_via).toBe("auto_appointment");
    expect(le?.source_appointment_id).toBe(apptId);
    expect(le?.event_date).toBe("2026-02-10");
    expect(le?.title).toBe("Cycle 4 Day 1");
  });

  it("is idempotent — second call returns the same life_event", async () => {
    const apptId = (await db.appointments.add({
      title: "Scan",
      starts_at: "2026-03-01T11:00:00+11:00",
      kind: "scan",
      status: "attended",
      created_at: "2026-03-01T11:00:00+11:00",
      updated_at: "2026-03-01T11:00:00+11:00",
    })) as number;

    const firstId = await promoteAppointmentToLifeEvent(apptId, "catherine");
    const secondId = await promoteAppointmentToLifeEvent(apptId, "thomas");
    expect(secondId).toBe(firstId);
    const rows = await db.life_events
      .where("source_appointment_id")
      .equals(apptId)
      .toArray();
    expect(rows).toHaveLength(1);
  });

  it("throws when the appointment does not exist", async () => {
    await expect(
      promoteAppointmentToLifeEvent(9999, "thomas"),
    ).rejects.toThrow(/not found/);
  });

  it("uses a custom title when provided", async () => {
    const apptId = (await db.appointments.add({
      title: "Clinic",
      starts_at: "2026-04-01T10:00:00+11:00",
      kind: "clinic",
      status: "attended",
      created_at: "2026-04-01T10:00:00+11:00",
      updated_at: "2026-04-01T10:00:00+11:00",
    })) as number;
    const leId = await promoteAppointmentToLifeEvent(
      apptId,
      "thomas",
      "The day Dad and I met Dr Lee for the first time",
    );
    const le = await db.life_events.get(leId);
    expect(le?.title).toBe("The day Dad and I met Dr Lee for the first time");
  });
});
