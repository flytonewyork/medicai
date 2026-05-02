import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { buildPathway } from "~/lib/pathway/build";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const ts = "2026-04-29T08:00:00";

describe("buildPathway", () => {
  it("buckets items into upcoming / recent / earlier from a fixed `to`", async () => {
    // Past appointment within recent window
    await db.appointments.add({
      kind: "clinic",
      title: "Sumi consult",
      starts_at: "2026-04-25T10:00:00",
      status: "attended",
      created_at: ts,
      updated_at: ts,
    });
    // Future appointment
    await db.appointments.add({
      kind: "scan",
      title: "PET-CT",
      starts_at: "2026-05-04T07:00:00",
      status: "scheduled",
      created_at: ts,
      updated_at: ts,
    });
    // Earlier appointment (>14 days back)
    await db.appointments.add({
      kind: "blood_test",
      title: "Bloods",
      starts_at: "2026-04-10T08:00:00",
      status: "attended",
      created_at: ts,
      updated_at: ts,
    });

    // Lab in recent window
    await db.labs.add({
      date: "2026-04-26",
      ca199: 28,
      source: "epworth",
      created_at: ts,
      updated_at: ts,
    });

    // Imaging in recent window
    await db.imaging.add({
      date: "2026-04-23",
      modality: "PET",
      findings_summary: "All clear",
      created_at: ts,
      updated_at: ts,
    });

    const pathway = await buildPathway({ to: "2026-04-29" });

    expect(pathway.upcoming.map((i) => i.title)).toEqual(["PET-CT"]);
    expect(pathway.recent.map((i) => i.title).sort()).toEqual(
      ["PET — All clear", "CA 19-9 28", "Sumi consult"].sort(),
    );
    expect(pathway.earlier.map((i) => i.title)).toEqual(["Bloods"]);
  });

  it("today's scheduled appointments go to upcoming, today's labs go to recent", async () => {
    await db.appointments.add({
      kind: "chemo",
      title: "Cycle 3 chemo",
      starts_at: "2026-04-29T11:00:00",
      status: "scheduled",
      created_at: ts,
      updated_at: ts,
    });
    await db.labs.add({
      date: "2026-04-29",
      wbc: 4.5,
      source: "epworth",
      created_at: ts,
      updated_at: ts,
    });

    const pathway = await buildPathway({ to: "2026-04-29" });

    expect(pathway.upcoming.map((i) => i.title)).toEqual(["Cycle 3 chemo"]);
    expect(pathway.recent.map((i) => i.title)).toEqual(["WBC 4.5"]);
  });

  it("pulls clinic_visit out of voice memos as a memo_visit row", async () => {
    await db.voice_memos.add({
      recorded_at: "2026-04-28T13:00:00",
      day: "2026-04-28",
      duration_ms: 30000,
      transcript: "Just back from chemo.",
      locale: "en",
      audio_mime: "audio/webm",
      audio_size_bytes: 100,
      entered_by: "hulin",
      parsed_fields: {
        confidence: "high",
        clinical: {
          clinic_visit: {
            kind: "chemo",
            summary: "First chemo session, felt normal.",
            visit_date: "2026-04-28",
          },
        },
      },
      created_at: ts,
      updated_at: ts,
    });

    const pathway = await buildPathway({ to: "2026-04-29" });
    const memoItems = [...pathway.recent, ...pathway.earlier].filter(
      (i) => i.category === "memo_visit",
    );
    expect(memoItems).toHaveLength(1);
    expect(memoItems[0]?.body).toContain("First chemo session");
  });

  it("emits started + stopped pathway items per medication when both dates exist", async () => {
    await db.medications.add({
      drug_id: "creon",
      display_name: "Creon",
      category: "pert",
      dose: "25,000 units",
      route: "PO",
      schedule: { kind: "with_meals" },
      source: "user_added",
      active: false,
      started_on: "2026-04-15",
      stopped_on: "2026-04-26",
      created_at: ts,
      updated_at: ts,
    });

    const pathway = await buildPathway({ to: "2026-04-29" });
    const medItems = [...pathway.recent, ...pathway.earlier].filter(
      (i) => i.category === "medication",
    );
    expect(medItems.map((i) => i.title).sort()).toEqual([
      "Started Creon",
      "Stopped Creon",
    ]);
  });
});
