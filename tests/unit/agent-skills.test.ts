import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import { allSkills, skillsByName } from "~/agents/skills/registry";
import { dispatchSkill } from "~/agents/skills/dispatch";

const TODAY = "2026-05-06";
const ts = () => new Date().toISOString();

beforeEach(async () => {
  // Wipe all tables the skill handlers touch so tests are isolated.
  await db.labs.clear();
  await db.daily_entries.clear();
  await db.appointments.clear();
  await db.care_team.clear();
  await db.patient_tasks.clear();
});

describe("agent skill registry", () => {
  it("has a unique name per skill and every skill has a schema", () => {
    const names = allSkills.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of allSkills) {
      expect(s.description.length).toBeGreaterThan(10);
      expect(s.input_schema).toBeDefined();
    }
  });

  it("skillsByName matches allSkills", () => {
    for (const s of allSkills) {
      expect(skillsByName[s.name]).toBe(s);
    }
  });
});

describe("dispatchSkill — errors", () => {
  it("rejects an unknown skill name", async () => {
    const r = await dispatchSkill("does_not_exist", {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown_skill/);
  });

  it("rejects a call missing a required field", async () => {
    const r = await dispatchSkill("add_discussion_item", {
      // missing appointment_id + text
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/bad_input/);
  });
});

describe("read_labs", () => {
  it("returns newest-first with analyte projection", async () => {
    await db.labs.bulkAdd([
      {
        date: "2026-05-01",
        glucose: 6.2,
        source: "patient_self_report",
        created_at: ts(),
        updated_at: ts(),
      },
      {
        date: "2026-05-05",
        glucose: 7.9,
        source: "patient_self_report",
        created_at: ts(),
        updated_at: ts(),
      },
      {
        date: "2026-05-03",
        ca199: 42,
        source: "external",
        created_at: ts(),
        updated_at: ts(),
      },
    ]);

    const r = await dispatchSkill("read_labs", { analyte: "glucose" });
    expect(r.ok).toBe(true);
    const rows = (r.output as { rows: Array<{ date: string; glucose: number }> }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.date).toBe("2026-05-05");
    expect(rows[0]!.glucose).toBe(7.9);
  });

  it("filters by since / until", async () => {
    await db.labs.bulkAdd([
      { date: "2026-04-01", glucose: 5, source: "patient_self_report", created_at: ts(), updated_at: ts() },
      { date: "2026-05-01", glucose: 6, source: "patient_self_report", created_at: ts(), updated_at: ts() },
      { date: "2026-06-01", glucose: 7, source: "patient_self_report", created_at: ts(), updated_at: ts() },
    ]);
    const r = await dispatchSkill("read_labs", {
      analyte: "glucose",
      since: "2026-05-01",
      until: "2026-05-31",
    });
    const rows = (r.output as { rows: unknown[] }).rows;
    expect(rows).toHaveLength(1);
  });
});

describe("read_appointments", () => {
  it("returns only upcoming, filterable by kind", async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    await db.appointments.bulkAdd([
      { kind: "clinic", title: "Upcoming clinic", starts_at: soon, status: "scheduled", created_at: ts(), updated_at: ts() },
      { kind: "chemo", title: "Upcoming chemo", starts_at: soon, status: "scheduled", created_at: ts(), updated_at: ts() },
      { kind: "clinic", title: "Past clinic", starts_at: past, status: "attended", created_at: ts(), updated_at: ts() },
    ]);
    const r = await dispatchSkill("read_appointments", { kind: "clinic" });
    const rows = (r.output as { rows: Array<{ title: string }> }).rows;
    expect(rows.map((a) => a.title)).toEqual(["Upcoming clinic"]);
  });
});

describe("read_care_team", () => {
  it("returns leads first, filterable by role", async () => {
    await db.care_team.bulkAdd([
      { name: "Sumi", role: "nurse", is_lead: true, created_at: ts(), updated_at: ts() },
      { name: "Other nurse", role: "nurse", is_lead: false, created_at: ts(), updated_at: ts() },
      { name: "Dr Lee", role: "oncologist", is_lead: true, created_at: ts(), updated_at: ts() },
    ]);
    const r = await dispatchSkill("read_care_team", { role: "nurse" });
    const rows = (r.output as { rows: Array<{ name: string; is_lead?: boolean }> }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.is_lead).toBe(true);
    expect(rows[0]!.name).toBe("Sumi");
  });
});

describe("add_discussion_item", () => {
  it("writes to the target appointment and dedupes", async () => {
    const id = (await db.appointments.add({
      kind: "clinic",
      title: "Onc review",
      starts_at: TODAY + "T09:00:00Z",
      status: "scheduled",
      created_at: ts(),
      updated_at: ts(),
    })) as number;

    const r1 = await dispatchSkill("add_discussion_item", {
      appointment_id: id,
      text: "Fasting glucose 7.9 on 5 May",
    });
    expect(r1.ok).toBe(true);
    expect((r1.output as { duplicate?: boolean }).duplicate).toBe(false);

    const r2 = await dispatchSkill("add_discussion_item", {
      appointment_id: id,
      text: "fasting glucose 7.9 on 5 may", // same text, different casing
    });
    expect(r2.ok).toBe(true);
    expect((r2.output as { duplicate?: boolean }).duplicate).toBe(true);

    const appt = await db.appointments.get(id);
    expect(appt!.discussion_items).toHaveLength(1);
    expect(appt!.discussion_items![0]!.source).toBe("agent");
  });

  it("returns an error result when the appointment doesn't exist", async () => {
    const r = await dispatchSkill("add_discussion_item", {
      appointment_id: 99999,
      text: "ghost",
    });
    expect(r.ok).toBe(true);
    expect((r.output as { ok: boolean }).ok).toBe(false);
    expect((r.output as { error?: string }).error).toMatch(/not_found/);
  });
});

describe("add_task", () => {
  it("inserts a task with coerced category", async () => {
    const r = await dispatchSkill("add_task", {
      title: "Book FBE before next cycle",
      due_date: "2026-05-10",
      category: "bogus",
    });
    expect(r.ok).toBe(true);
    const id = (r.output as { id: number }).id;
    const row = await db.patient_tasks.get(id);
    expect(row!.title).toBe("Book FBE before next cycle");
    expect(row!.category).toBe("other"); // coerced
    expect(row!.active).toBe(true);
    expect(row!.due_date).toBe("2026-05-10");
  });
});
