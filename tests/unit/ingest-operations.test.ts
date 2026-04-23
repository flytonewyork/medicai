import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { applyIngestOps } from "~/lib/ingest/operations";
import type { IngestOp } from "~/types/ingest";

beforeEach(async () => {
  // Reset Dexie between tests so applied rows don't leak.
  await db.delete();
  await db.open();
});

describe("applyIngestOps", () => {
  it("adds appointments and returns their ids", async () => {
    const ops: IngestOp[] = [
      {
        kind: "add_appointment",
        data: {
          kind: "clinic",
          title: "Dr Ananda consult",
          starts_at: "2026-04-29T09:20:00+10:00",
        },
      },
      {
        kind: "add_appointment",
        data: {
          kind: "chemo",
          title: "DOU infusion",
          starts_at: "2026-04-29T10:00:00+10:00",
          location: "Epworth, Level 2",
        },
      },
    ];
    const results = await applyIngestOps(ops);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(typeof results[0]!.id).toBe("number");

    const all = await db.appointments.toArray();
    expect(all).toHaveLength(2);
    const titles = all.map((a) => a.title).sort();
    expect(titles).toEqual(["DOU infusion", "Dr Ananda consult"]);
  });

  it("updates an existing appointment matched by title + date", async () => {
    await db.appointments.add({
      kind: "clinic",
      title: "Dr Ananda consult",
      starts_at: "2026-04-29T09:20:00+10:00",
      status: "scheduled",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const op: IngestOp = {
      kind: "update_appointment",
      match: { title_contains: "ananda", on_date: "2026-04-29" },
      changes: { status: "rescheduled", notes: "Rescheduled to 30 Apr" },
      reason: "Letter dated later supersedes original time",
    };
    const [r] = await applyIngestOps([op]);
    expect(r!.ok).toBe(true);

    const updated = (await db.appointments.toArray())[0];
    expect(updated!.status).toBe("rescheduled");
    expect(updated!.notes).toMatch(/Rescheduled/);
  });

  it("returns no_match when an update can't find a target", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "update_appointment",
        match: { title_contains: "nonexistent" },
        changes: { status: "cancelled" },
        reason: "test",
      } as IngestOp,
    ]);
    expect(r!.ok).toBe(false);
    expect(r!.error).toBe("no_match");
  });

  it("returns ambiguous_match when an update matches multiple rows", async () => {
    const ts = new Date().toISOString();
    for (let i = 0; i < 2; i += 1) {
      await db.appointments.add({
        kind: "clinic",
        title: `Dr Ananda consult ${i}`,
        starts_at: "2026-04-29T09:20:00+10:00",
        status: "scheduled",
        created_at: ts,
        updated_at: ts,
      });
    }
    const [r] = await applyIngestOps([
      {
        kind: "update_appointment",
        match: { title_contains: "ananda", on_date: "2026-04-29" },
        changes: { status: "cancelled" },
        reason: "test",
      } as IngestOp,
    ]);
    expect(r!.ok).toBe(false);
    expect(r!.error).toBe("ambiguous_match");
  });

  it("adds a care-team member and enforces role default", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "add_care_team_member",
        data: {
          name: "A/Prof Sumitra Ananda",
          role: "oncologist",
          phone: "03 9417 1344",
          organisation: "Epworth",
        },
      },
    ]);
    expect(r!.ok).toBe(true);

    const team = await db.care_team.toArray();
    expect(team).toHaveLength(1);
    expect(team[0]!.name).toBe("A/Prof Sumitra Ananda");
    expect(team[0]!.role).toBe("oncologist");
  });

  it("adds an imaging row", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "add_imaging",
        data: {
          date: "2026-04-22",
          modality: "PET",
          findings_summary: "Stable disease, no new lesions.",
        },
      },
    ]);
    expect(r!.ok).toBe(true);
    const all = await db.imaging.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.modality).toBe("PET");
  });

  it("adds a ctDNA result", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "add_ctdna_result",
        data: {
          date: "2026-04-22",
          platform: "signatera",
          detected: true,
          value: 0.42,
        },
      },
    ]);
    expect(r!.ok).toBe(true);
    const all = await db.ctdna_results.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.platform).toBe("signatera");
  });

  it("adds a treatment cycle with sensible defaults", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "add_treatment_cycle",
        data: {
          protocol_id: "gnp_weekly",
          cycle_number: 4,
          start_date: "2026-05-13",
        },
      },
    ]);
    expect(r!.ok).toBe(true);
    const all = await db.treatment_cycles.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe("active");
    expect(all[0]!.dose_level).toBe(0);
  });

  it("adds a decision row", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "add_decision",
        data: {
          decision_date: "2026-04-22",
          title: "Trial enrolment",
          decision: "Enrol in RASolute 303 trial",
          rationale: "Best chance at daraxonrasib bridge",
          decided_by: "Hu Lin + Dr Ananda",
        },
      },
    ]);
    expect(r!.ok).toBe(true);
    const all = await db.decisions.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.decision).toMatch(/RASolute/);
  });

  it("update_settings refuses when no settings row exists", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "update_settings",
        changes: { managing_oncologist: "Dr Lee" },
        reason: "letter",
      },
    ]);
    expect(r!.ok).toBe(false);
    expect(r!.error).toBe("no_settings_row");
  });

  it("update_settings patches the limited subset when a row exists", async () => {
    const ts = new Date().toISOString();
    await db.settings.add({
      profile_name: "Hu Lin",
      locale: "en",
      created_at: ts,
      updated_at: ts,
    });
    const [r] = await applyIngestOps([
      {
        kind: "update_settings",
        changes: {
          managing_oncologist: "A/Prof Sumitra Ananda",
          managing_oncologist_phone: "03 9417 1344",
        },
        reason: "Letterhead",
      },
    ]);
    expect(r!.ok).toBe(true);
    const row = (await db.settings.toArray())[0];
    expect(row!.managing_oncologist).toBe("A/Prof Sumitra Ananda");
  });

  it("update_lab_result no-matches by date", async () => {
    const [r] = await applyIngestOps([
      {
        kind: "update_lab_result",
        match: { on_date: "2026-04-22" },
        changes: { ca199: 99 },
        reason: "amended report",
      },
    ]);
    expect(r!.ok).toBe(false);
    expect(r!.error).toBe("no_match");
  });

  it("update_lab_result patches the matched row", async () => {
    const ts = new Date().toISOString();
    await db.labs.add({
      date: "2026-04-22",
      source: "external",
      ca199: 80,
      created_at: ts,
      updated_at: ts,
    });
    const [r] = await applyIngestOps([
      {
        kind: "update_lab_result",
        match: { on_date: "2026-04-22" },
        changes: { ca199: 99, notes: "Amended" },
        reason: "amended report",
      },
    ]);
    expect(r!.ok).toBe(true);
    const row = (await db.labs.toArray())[0];
    expect(row!.ca199).toBe(99);
    expect(row!.notes).toBe("Amended");
  });

  it("stops on first error when stopOnError is set", async () => {
    const ops: IngestOp[] = [
      {
        kind: "update_appointment",
        match: { title_contains: "ghost" },
        changes: {},
        reason: "test",
      },
      {
        kind: "add_appointment",
        data: {
          kind: "blood_test",
          title: "FBE",
          starts_at: "2026-04-30T08:00:00+10:00",
        },
      },
    ];
    const results = await applyIngestOps(ops, { stopOnError: true });
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(false);
    const all = await db.appointments.toArray();
    expect(all).toHaveLength(0);
  });
});
