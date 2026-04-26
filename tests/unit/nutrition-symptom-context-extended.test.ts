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

describe("deriveFlags — extended JPCC symptoms", () => {
  it("flags dry_mouth when set", () => {
    expect(deriveFlags(entry({ dry_mouth: true }))).toContain("dry_mouth");
    expect(deriveFlags(entry({ dry_mouth: false }))).not.toContain("dry_mouth");
  });

  it("flags early_satiety when set", () => {
    expect(deriveFlags(entry({ early_satiety: true }))).toContain(
      "early_satiety",
    );
    expect(deriveFlags(entry({ early_satiety: false }))).not.toContain(
      "early_satiety",
    );
  });

  it("flags taste_change when taste_issue is set to anything other than 'normal'", () => {
    expect(deriveFlags(entry({ taste_issue: "metallic" }))).toContain(
      "taste_change",
    );
    expect(deriveFlags(entry({ taste_issue: "too_bland" }))).toContain(
      "taste_change",
    );
    expect(deriveFlags(entry({ taste_issue: "normal" }))).not.toContain(
      "taste_change",
    );
  });

  it("flags taste_change when taste_changes severity >= 3", () => {
    expect(deriveFlags(entry({ taste_changes: 4 }))).toContain("taste_change");
    expect(deriveFlags(entry({ taste_changes: 1 }))).not.toContain(
      "taste_change",
    );
  });

  it("returns empty for an entry with no JPCC-flagged symptoms", () => {
    expect(deriveFlags(entry({ nausea: 1, appetite: 8 }))).toEqual([]);
  });
});

describe("loadSymptomContext — exposes extended flags", () => {
  it("recommendsEasyDigest when only dry_mouth is set (still a JPCC trigger)", async () => {
    await db.daily_entries.add(entry({ dry_mouth: true }));
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.flags).toContain("dry_mouth");
    expect(ctx.recommendEasyDigest).toBe(true);
  });

  it("exposes taste_issue on the context for the tweak suggester", async () => {
    await db.daily_entries.add(entry({ taste_issue: "metallic" }));
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.taste_issue).toBe("metallic");
    expect(ctx.flags).toContain("taste_change");
  });

  it("falls back to yesterday for taste_issue when today has no entry", async () => {
    await db.daily_entries.add(
      entry({
        date: "2026-04-24",
        entered_at: "2026-04-24T08:00:00Z",
        taste_issue: "too_bland",
      }),
    );
    const ctx = await loadSymptomContext("2026-04-25");
    expect(ctx.taste_issue).toBe("too_bland");
  });
});
