import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  extractNumericValue,
  findAppointmentForImaging,
  findAppointmentForLab,
  mapLabName,
  mapModality,
} from "~/lib/voice-memo/match";
import { applyMemoPatches } from "~/lib/voice-memo/apply";
import { persistVoiceMemo } from "~/lib/voice-memo/persist";
import type { Appointment } from "~/types/appointment";
import type { VoiceMemoParsedFields } from "~/types/voice-memo";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const ts = "2026-04-29T08:00:00";

async function makeMemo(parsed: VoiceMemoParsedFields, day = "2026-04-29") {
  const { memo_id } = await persistVoiceMemo({
    blob: new Blob([new Uint8Array(8)], { type: "audio/webm" }),
    mime: "audio/webm",
    duration_ms: 4000,
    transcript: "test",
    locale: "en",
    entered_by: "hulin",
    source_screen: "diary",
    recorded_at: `${day}T08:00:00`,
  });
  await db.voice_memos.update(memo_id, {
    parsed_fields: parsed,
    updated_at: ts,
  });
  return memo_id;
}

async function makeAppointment(partial: Partial<Appointment>): Promise<number> {
  const row: Appointment = {
    kind: "scan",
    title: "PET-CT scan",
    starts_at: "2026-04-29T07:00:00",
    status: "scheduled",
    created_at: ts,
    updated_at: ts,
    ...partial,
  } as Appointment;
  return (await db.appointments.add(row)) as number;
}

describe("mapModality + mapLabName", () => {
  it("maps memo modality to Imaging table enum", () => {
    expect(mapModality("pet")).toBe("PET");
    expect(mapModality("ct")).toBe("CT");
    expect(mapModality("mri")).toBe("MRI");
    expect(mapModality("ultrasound")).toBe("US");
    expect(mapModality("xray")).toBe("other");
    expect(mapModality("bone_scan")).toBe("other");
  });

  it("maps free-text lab names to typed LabResult keys", () => {
    expect(mapLabName("CA 19-9")).toBe("ca199");
    expect(mapLabName("ca199")).toBe("ca199");
    expect(mapLabName("CEA")).toBe("cea");
    expect(mapLabName("white cells")).toBe("wbc");
    expect(mapLabName("hemoglobin")).toBe("hemoglobin");
    expect(mapLabName("haemoglobin")).toBe("hemoglobin");
    expect(mapLabName("Vitamin D")).toBe("vit_d");
    expect(mapLabName("absolute neutrophils")).toBe("neutrophils");
    // Unknown returns null so the apply step skips writing to /labs.
    expect(mapLabName("some random analyte")).toBeNull();
  });

  it("extracts numeric values out of decorated free-text", () => {
    expect(extractNumericValue("28")).toBe(28);
    expect(extractNumericValue("28 U/mL")).toBe(28);
    expect(extractNumericValue("5.2 ×10^9/L")).toBe(5.2);
    expect(extractNumericValue("<0.5")).toBe(0.5);
    expect(extractNumericValue("normal")).toBeNull();
    expect(extractNumericValue(undefined)).toBeNull();
    expect(extractNumericValue("")).toBeNull();
  });
});

describe("findAppointmentForImaging", () => {
  it("returns the closest scan appointment within the look-back window", async () => {
    await makeAppointment({
      title: "Old PET scan",
      starts_at: "2026-04-10T07:00:00", // 19 days back — outside window
    });
    const recentId = await makeAppointment({
      title: "PET-CT scan at Epworth",
      starts_at: "2026-04-22T07:00:00", // 7 days back — inside window
    });
    const match = await findAppointmentForImaging("pet", "2026-04-29");
    expect(match?.id).toBe(recentId);
  });

  it("ignores cancelled appointments", async () => {
    await makeAppointment({
      title: "PET CT cancelled",
      starts_at: "2026-04-25T07:00:00",
      status: "cancelled",
    });
    const match = await findAppointmentForImaging("pet", "2026-04-29");
    expect(match).toBeNull();
  });

  it("scores blood-test kinds higher when looking for a lab", async () => {
    const bloods = await makeAppointment({
      kind: "blood_test",
      title: "Routine bloods",
      starts_at: "2026-04-28T08:00:00",
    });
    await makeAppointment({
      kind: "clinic",
      title: "Sumi consult",
      starts_at: "2026-04-28T10:00:00",
    });
    const match = await findAppointmentForLab("2026-04-29");
    expect(match?.id).toBe(bloods);
  });
});

describe("applyMemoPatches — imaging linking", () => {
  it("auto-links a memo to an existing scan appointment without creating a new imaging row", async () => {
    const apptId = await makeAppointment({
      title: "PET-CT scan",
      starts_at: "2026-04-29T07:00:00",
      status: "scheduled",
    });
    const memoId = await makeMemo({
      confidence: "high",
      imaging_results: [
        {
          modality: "pet",
          finding_summary: "all clear",
          status: "clear",
        },
      ],
    });

    const patches = await applyMemoPatches(memoId);

    // Linked the appointment, did not touch /imaging.
    expect(patches.some((p) => p.table === "appointments" && p.op === "update")).toBe(true);
    expect(patches.some((p) => p.table === "imaging")).toBe(false);

    const after = await db.appointments.get(apptId);
    expect(after?.status).toBe("attended");
    expect(after?.notes).toContain("all clear");
    expect(after?.source_memo_id).toBe(memoId);
    expect(await db.imaging.toArray()).toHaveLength(0);
  });

  it("creates a new imaging row when the patient ticks the toggle, keyed back to the memo and the appointment", async () => {
    const apptId = await makeAppointment({
      title: "CT scan abdomen",
      starts_at: "2026-04-28T07:00:00",
      status: "scheduled",
    });
    const memoId = await makeMemo({
      confidence: "high",
      imaging_results: [
        {
          modality: "ct",
          finding_summary: "no progression",
          status: "stable",
        },
      ],
    });

    const patches = await applyMemoPatches(memoId, { imaging_create: [true] });

    const imagingPatch = patches.find((p) => p.table === "imaging");
    expect(imagingPatch?.op).toBe("create");
    const imaging = await db.imaging.get(imagingPatch!.row_id);
    expect(imaging?.modality).toBe("CT");
    expect(imaging?.findings_summary).toBe("no progression");
    expect(imaging?.source_memo_id).toBe(memoId);
    expect(imaging?.source_appointment_id).toBe(apptId);
  });
});

describe("applyMemoPatches — lab linking", () => {
  it("links a bloods appointment but skips /labs when value is qualitative", async () => {
    const apptId = await makeAppointment({
      kind: "blood_test",
      title: "Routine bloods",
      starts_at: "2026-04-29T08:00:00",
      status: "scheduled",
    });
    const memoId = await makeMemo({
      confidence: "high",
      lab_results: [
        { name: "white cells", status: "normal" },
      ],
    });

    const patches = await applyMemoPatches(memoId, { lab_create: [true] });

    expect(patches.some((p) => p.table === "appointments")).toBe(true);
    // Qualitative — no labs row even with the toggle on.
    expect(patches.some((p) => p.table === "labs")).toBe(false);
    expect(await db.labs.toArray()).toHaveLength(0);

    const after = await db.appointments.get(apptId);
    expect(after?.status).toBe("attended");
    expect(after?.notes).toContain("white cells");
  });

  it("creates a typed labs row when a numeric value maps to a known analyte", async () => {
    const memoId = await makeMemo({
      confidence: "high",
      lab_results: [
        { name: "CA 19-9", value: "28", status: "raised" },
      ],
    });

    const patches = await applyMemoPatches(memoId, { lab_create: [true] });

    const labsPatch = patches.find((p) => p.table === "labs");
    expect(labsPatch?.op).toBe("create");
    const row = await db.labs.get(labsPatch!.row_id);
    expect(row?.ca199).toBe(28);
    expect(row?.source).toBe("patient_self_report");
    expect(row?.source_memo_id).toBe(memoId);
  });

  it("safe-fills an existing same-day labs row instead of creating a duplicate", async () => {
    await db.labs.add({
      date: "2026-04-29",
      cea: 3.2,
      source: "epworth",
      created_at: ts,
      updated_at: ts,
    });
    const memoId = await makeMemo({
      confidence: "high",
      lab_results: [
        { name: "CA 19-9", value: "28", status: "raised" },
      ],
    });

    await applyMemoPatches(memoId, { lab_create: [true] });

    const rows = await db.labs.where("date").equals("2026-04-29").toArray();
    // No duplicate row was created — the memo's value joined the existing one.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ca199).toBe(28);
    expect(rows[0]?.cea).toBe(3.2); // pre-existing value untouched
    expect(rows[0]?.source).toBe("epworth"); // source not overwritten
  });
});
