import { describe, it, expect } from "vitest";
import {
  buildGiSeries,
  projectGiDay,
  summariseGiSeries,
} from "~/lib/calculations/gi-trends";
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

describe("projectGiDay", () => {
  it("prefers stool_count over diarrhoea_count", () => {
    const g = projectGiDay(
      entry("2026-05-01", { stool_count: 2, diarrhoea_count: 5 }),
    );
    expect(g.count).toBe(2);
  });

  it("falls back to diarrhoea_count when stool_count is undefined", () => {
    const g = projectGiDay(entry("2026-05-01", { diarrhoea_count: 4 }));
    expect(g.count).toBe(4);
  });

  it("merges stool_oil and legacy steatorrhoea into a single oil flag", () => {
    expect(projectGiDay(entry("2026-05-01", { stool_oil: true })).oil).toBe(true);
    expect(projectGiDay(entry("2026-05-01", { steatorrhoea: true })).oil).toBe(
      true,
    );
    expect(projectGiDay(entry("2026-05-01")).oil).toBe(false);
  });
});

describe("buildGiSeries", () => {
  it("emits oldest-to-newest with placeholder rows for missing days", () => {
    const series = buildGiSeries(
      [entry("2026-05-01", { stool_count: 3 })],
      "2026-05-03",
      3,
    );
    expect(series.map((g) => g.date)).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
    ]);
    expect(series[0]?.count).toBe(3);
    expect(series[1]?.count).toBe(null);
    expect(series[2]?.count).toBe(null);
  });
});

describe("summariseGiSeries", () => {
  function buildAndSummarise(rows: DailyEntry[], todayISO: string, days: number) {
    return summariseGiSeries(buildGiSeries(rows, todayISO, days));
  }

  it("counts days with any GI signal", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_count: 2 }),
        entry("2026-05-02"), // no signal
        entry("2026-05-03", { stool_oil: true }),
      ],
      "2026-05-03",
      3,
    );
    expect(s.days_with_data).toBe(2);
  });

  it("computes count_avg only over days with a number", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_count: 2 }),
        entry("2026-05-02", { stool_count: 4 }),
        entry("2026-05-03"), // skipped
      ],
      "2026-05-03",
      3,
    );
    expect(s.count_avg).toBe(3);
  });

  it("returns null count_avg when no days had a count", () => {
    const s = buildAndSummarise(
      [entry("2026-05-01", { stool_oil: true })],
      "2026-05-01",
      1,
    );
    expect(s.count_avg).toBe(null);
  });

  it("returns the predominant Bristol type as the mode", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_bristol: 4 }),
        entry("2026-05-02", { stool_bristol: 4 }),
        entry("2026-05-03", { stool_bristol: 6 }),
      ],
      "2026-05-03",
      3,
    );
    expect(s.bristol_mode).toBe(4);
  });

  it("computes PERT coverage ignoring no-fatty-meal days", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { pert_with_meals_today: "all" }),
        entry("2026-05-02", { pert_with_meals_today: "some" }),
        entry("2026-05-03", { pert_with_meals_today: "na" }), // excluded
      ],
      "2026-05-03",
      3,
    );
    expect(s.pert_coverage).toBe(0.5);
  });

  it("returns null pert_coverage when no eligible days", () => {
    const s = buildAndSummarise(
      [entry("2026-05-01", { pert_with_meals_today: "na" })],
      "2026-05-01",
      1,
    );
    expect(s.pert_coverage).toBe(null);
  });

  it("counts a loose streak from the most recent day backwards", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_bristol: 4 }),       // not loose
        entry("2026-05-02", { stool_bristol: 6 }),       // loose
        entry("2026-05-03", { stool_count: 5 }),         // loose by count
        entry("2026-05-04", { stool_oil: true }),        // loose by oil
      ],
      "2026-05-04",
      4,
    );
    expect(s.loose_streak).toBe(3);
  });

  it("breaks the loose streak on a missing day", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_bristol: 6 }),
        entry("2026-05-02", { stool_bristol: 7 }),
        // 2026-05-03 has no entry — counts as a break
        entry("2026-05-04", { stool_bristol: 6 }),
      ],
      "2026-05-04",
      4,
    );
    expect(s.loose_streak).toBe(1);
  });

  it("counts oil / urgency / blood days independently", () => {
    const s = buildAndSummarise(
      [
        entry("2026-05-01", { stool_oil: true, stool_urgency: true }),
        entry("2026-05-02", { stool_blood: true }),
        entry("2026-05-03"),
      ],
      "2026-05-03",
      3,
    );
    expect(s.oil_days).toBe(1);
    expect(s.urgency_days).toBe(1);
    expect(s.blood_days).toBe(1);
  });
});
