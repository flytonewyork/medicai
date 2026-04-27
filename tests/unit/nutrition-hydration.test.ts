import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "~/lib/db/dexie";
import {
  logFluid,
  listFluidsForDate,
  listFluidsBetween,
  deleteFluid,
  sumFluids,
  DEFAULT_FLUID_TARGET_ML,
} from "~/lib/nutrition/hydration";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("logFluid", () => {
  it("persists a row with date + kind + volume", async () => {
    const id = await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: 250,
      entered_by: "hulin",
    });
    const row = await db.fluid_logs.get(id);
    expect(row?.kind).toBe("water");
    expect(row?.volume_ml).toBe(250);
    expect(row?.date).toBe("2026-04-25");
  });

  it("rounds and clamps non-positive volumes", async () => {
    const id = await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: -50.4,
      entered_by: "hulin",
    });
    const row = await db.fluid_logs.get(id);
    expect(row?.volume_ml).toBe(0);
  });
});

describe("listFluidsForDate", () => {
  it("returns rows sorted by logged_at", async () => {
    await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: 250,
      entered_by: "hulin",
      logged_at: "2026-04-25T12:00:00Z",
    });
    await logFluid({
      date: "2026-04-25",
      kind: "tea",
      volume_ml: 200,
      entered_by: "hulin",
      logged_at: "2026-04-25T08:00:00Z",
    });
    const rows = await listFluidsForDate("2026-04-25");
    expect(rows.map((r) => r.kind)).toEqual(["tea", "water"]);
  });
});

describe("listFluidsBetween", () => {
  it("filters by inclusive date range", async () => {
    for (const d of ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"]) {
      await logFluid({
        date: d,
        kind: "water",
        volume_ml: 250,
        entered_by: "hulin",
      });
    }
    const rows = await listFluidsBetween("2026-04-24", "2026-04-25");
    expect(rows).toHaveLength(2);
  });
});

describe("deleteFluid", () => {
  it("removes the row", async () => {
    const id = await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: 250,
      entered_by: "hulin",
    });
    await deleteFluid(id);
    expect(await db.fluid_logs.get(id)).toBeUndefined();
  });
});

describe("sumFluids", () => {
  it("totals volume and groups by kind", async () => {
    await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: 250,
      entered_by: "hulin",
    });
    await logFluid({
      date: "2026-04-25",
      kind: "water",
      volume_ml: 500,
      entered_by: "hulin",
    });
    await logFluid({
      date: "2026-04-25",
      kind: "broth",
      volume_ml: 250,
      entered_by: "hulin",
    });
    const rows = await listFluidsForDate("2026-04-25");
    const t = sumFluids(rows);
    expect(t.total_ml).toBe(1000);
    expect(t.by_kind.water).toBe(750);
    expect(t.by_kind.broth).toBe(250);
    expect(t.count).toBe(3);
  });

  it("returns zero totals for empty input", () => {
    const t = sumFluids([]);
    expect(t.total_ml).toBe(0);
    expect(t.count).toBe(0);
  });
});

describe("default target", () => {
  it("is 2L/day", () => {
    expect(DEFAULT_FLUID_TARGET_ML).toBe(2000);
  });
});
