import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db, now } from "~/lib/db/dexie";
import {
  deriveFlags,
  loadSymptomContext,
} from "~/lib/nutrition/symptom-context";
import type { DailyEntry } from "~/types/clinical";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function entry(p: Partial<DailyEntry>): DailyEntry {
  return {
    date: "2026-04-25",
    entered_at: "2026-04-25T08:00:00Z",
    entered_by: "hulin",
    created_at: now(),
    updated_at: now(),
    ...p,
  };
}

describe("deriveFlags", () => {
  it("flags nausea above threshold", () => {
    expect(deriveFlags(entry({ nausea: 5 }))).toContain("nausea");
    expect(deriveFlags(entry({ nausea: 2 }))).not.toContain("nausea");
  });
  it("flags mucositis when mouth_sores is true", () => {
    expect(deriveFlags(entry({ mouth_sores: true }))).toContain("mucositis");
  });
  it("flags diarrhoea when count >= threshold", () => {
    expect(deriveFlags(entry({ diarrhoea_count: 2 }))).toContain("diarrhoea");
    expect(deriveFlags(entry({ diarrhoea_count: 1 }))).not.toContain("diarrhoea");
  });
  it("flags low appetite", () => {
    expect(deriveFlags(entry({ appetite: 3 }))).toContain("low_appetite");
    expect(deriveFlags(entry({ appetite: 8 }))).not.toContain("low_appetite");
  });
  it("returns empty when nothing concerning", () => {
    expect(
      deriveFlags(
        entry({ nausea: 1, appetite: 8, diarrhoea_count: 0 }),
      ),
    ).toEqual([]);
  });
});

describe("loadSymptomContext", () => {
  it("recommendsEasyDigest when today has flags", async () => {
    await db.daily_entries.add(entry({ date: "2026-04-25", nausea: 7 }));
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.recommendEasyDigest).toBe(true);
    expect(ctx.flags).toContain("nausea");
    expect(ctx.source_date).toBe("2026-04-25");
  });

  it("falls back to yesterday when today has no entry", async () => {
    await db.daily_entries.add(
      entry({
        date: "2026-04-24",
        entered_at: "2026-04-24T08:00:00Z",
        nausea: 6,
      }),
    );
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.flags).toContain("nausea");
    expect(ctx.source_date).toBe("2026-04-24");
  });

  it("does not recommend when nothing concerning", async () => {
    await db.daily_entries.add(
      entry({ date: "2026-04-25", nausea: 1, appetite: 8 }),
    );
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.recommendEasyDigest).toBe(false);
    expect(ctx.flags).toEqual([]);
  });

  it("returns empty context with no entries", async () => {
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.flags).toEqual([]);
    expect(ctx.recommendEasyDigest).toBe(false);
  });
});
