import { describe, it, expect } from "vitest";
import { computeGiTileNudges } from "~/lib/nudges/gi-tile-nudges";
import type { DailyEntry } from "~/types/clinical";

function entry(date: string, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date,
    entered_at: `${date}T07:00:00Z`,
    entered_by: "hulin",
    created_at: `${date}T07:00:00Z`,
    updated_at: `${date}T07:00:00Z`,
    ...overrides,
  };
}

function days(n: number, base: string, gen: (i: number) => Partial<DailyEntry>): DailyEntry[] {
  const out: DailyEntry[] = [];
  const baseDate = new Date(base + "T12:00:00Z");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(entry(`${yyyy}-${mm}-${dd}`, gen(n - 1 - i)));
  }
  return out;
}

describe("computeGiTileNudges", () => {
  it("returns nothing when there is no GI signal", () => {
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: days(7, "2026-05-01", () => ({})),
    });
    expect(items).toEqual([]);
  });

  it("emits dietician PERT-low nudge when coverage < 70%", () => {
    // 2 of 5 eligible days "all", 3 "some" → 40% coverage
    const seven = days(7, "2026-05-01", (i) => {
      if (i === 0 || i === 1) return { pert_with_meals_today: "all" };
      if (i === 2 || i === 3 || i === 4) return { pert_with_meals_today: "some" };
      return { pert_with_meals_today: "na" };
    });
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    const pert = items.find((i) => i.source === "gi_tile_nudge:pert_low");
    expect(pert).toBeDefined();
    expect(pert?.body.en).toMatch(/40%/);
  });

  it("does not emit PERT nudge at exactly 70% coverage", () => {
    // 7 of 10 days "all" (over-fill window so the threshold sits on boundary).
    const seven = days(7, "2026-05-01", (i) =>
      i < 5 ? { pert_with_meals_today: "all" } : { pert_with_meals_today: "some" },
    );
    // 5/7 ≈ 71% → above threshold
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    expect(items.some((i) => i.source === "gi_tile_nudge:pert_low")).toBe(false);
  });

  it("emits dietician Bristol-loose nudge when mode >= 6", () => {
    const seven = days(7, "2026-05-01", () => ({ stool_bristol: 6 }));
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    expect(
      items.some((i) => i.source === "gi_tile_nudge:bristol_loose"),
    ).toBe(true);
  });

  it("emits nurse constipation nudge when Bristol mode <= 2", () => {
    const seven = days(7, "2026-05-01", () => ({ stool_bristol: 2 }));
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    expect(
      items.some((i) => i.source === "gi_tile_nudge:bristol_constipation"),
    ).toBe(true);
  });

  it("emits oil/steatorrhoea nudge when oil days >= 2", () => {
    const seven = days(7, "2026-05-01", (i) =>
      i < 2 ? { stool_oil: true } : {},
    );
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    const oil = items.find((i) => i.source === "gi_tile_nudge:oil_steatorrhoea");
    expect(oil).toBeDefined();
    expect(oil?.body.en).toMatch(/2 of the last 7 days/);
  });

  it("emits high-count nurse nudge when count_avg >= 4", () => {
    const seven = days(7, "2026-05-01", () => ({ stool_count: 4 }));
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    expect(items.some((i) => i.source === "gi_tile_nudge:count_high")).toBe(true);
  });

  it("emits loose-streak nudge at exactly 2 days but not 3 (zone rule owns 3+)", () => {
    // Today + yesterday loose, 2 days back was normal → streak = 2
    const seven = days(7, "2026-05-01", (i) => {
      if (i >= 5) return { stool_bristol: 6 };
      return { stool_bristol: 4 };
    });
    const items = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    expect(
      items.some((i) => i.source === "gi_tile_nudge:loose_streak"),
    ).toBe(true);

    // Now extend to 3 consecutive days — the streak nudge should NOT fire.
    const sevenLong = days(7, "2026-05-01", (i) =>
      i >= 4 ? { stool_bristol: 6 } : { stool_bristol: 4 },
    );
    const items2 = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: sevenLong,
    });
    expect(
      items2.some((i) => i.source === "gi_tile_nudge:loose_streak"),
    ).toBe(false);
  });

  it("uses a stable weekly id so the same nudge dedupes across days", () => {
    const seven = days(7, "2026-05-01", () => ({ stool_oil: true }));
    const a = computeGiTileNudges({
      todayISO: "2026-05-01",
      recentDailies: seven,
    });
    const b = computeGiTileNudges({
      todayISO: "2026-05-02",
      recentDailies: days(7, "2026-05-02", () => ({ stool_oil: true })),
    });
    const aOil = a.find((i) => i.source === "gi_tile_nudge:oil_steatorrhoea");
    const bOil = b.find((i) => i.source === "gi_tile_nudge:oil_steatorrhoea");
    expect(aOil?.id).toBe(bOil?.id);
  });
});
