import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { db, now } from "~/lib/db/dexie";
import type { DailyEntry } from "~/types/clinical";

// JPCC-shaped capture additions to DailyEntry. These are TypeScript-
// only; Dexie's daily_entries store has no index for them so no
// schema bump is needed. The test confirms (a) the fields type-check,
// (b) round-trip through Dexie cleanly, (c) older rows without the
// new fields still load.

describe("DailyEntry — JPCC-shaped optional capture fields", () => {
  it("accepts dry_mouth, early_satiety, taste_issue at the type level", () => {
    const e: DailyEntry = {
      date: "2026-04-25",
      entered_at: "2026-04-25T08:00:00Z",
      entered_by: "hulin",
      dry_mouth: true,
      early_satiety: true,
      taste_issue: "metallic",
      created_at: now(),
      updated_at: now(),
    };
    expect(e.dry_mouth).toBe(true);
    expect(e.early_satiety).toBe(true);
    expect(e.taste_issue).toBe("metallic");
  });

  it("round-trips the new fields through Dexie", async () => {
    await db.delete();
    await db.open();
    const id = (await db.daily_entries.add({
      date: "2026-04-25",
      entered_at: "2026-04-25T08:00:00Z",
      entered_by: "hulin",
      dry_mouth: true,
      early_satiety: false,
      taste_issue: "too_salty",
      created_at: now(),
      updated_at: now(),
    })) as number;
    const round = await db.daily_entries.get(id);
    expect(round).toBeDefined();
    expect(round!.dry_mouth).toBe(true);
    expect(round!.early_satiety).toBe(false);
    expect(round!.taste_issue).toBe("too_salty");
  });

  it("loads legacy rows with no JPCC fields without throwing", async () => {
    await db.delete();
    await db.open();
    const id = (await db.daily_entries.add({
      date: "2026-04-25",
      entered_at: "2026-04-25T08:00:00Z",
      entered_by: "hulin",
      created_at: now(),
      updated_at: now(),
    })) as number;
    const row = await db.daily_entries.get(id);
    expect(row).toBeDefined();
    expect(row!.dry_mouth).toBeUndefined();
    expect(row!.taste_issue).toBeUndefined();
  });
});
