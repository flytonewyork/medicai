import { describe, it, expect } from "vitest";
import { computeFortnightlyPrompt } from "~/lib/nudges/fortnightly-prompt";
import type { FortnightlyAssessment } from "~/types/clinical";

function fa(date: string): FortnightlyAssessment {
  return {
    assessment_date: date,
    entered_at: `${date}T12:00:00Z`,
    entered_by: "hulin",
    ecog_self: 1,
    created_at: `${date}T12:00:00Z`,
    updated_at: `${date}T12:00:00Z`,
  };
}

describe("computeFortnightlyPrompt", () => {
  it("fires (never-done copy) when no fortnightly has ever been completed", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("fortnightly_due_2026-05-02");
    expect(items[0]?.title.en).toBe("Fortnightly check");
    expect(items[0]?.body.en).toContain("About 10 minutes");
    expect(items[0]?.cta?.href).toBe("/fortnightly/new");
  });

  it("does not fire when latest fortnightly is recent (< 12 days)", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [fa("2026-04-25")], // 7 days ago
    });
    expect(items).toEqual([]);
  });

  it("fires (overdue copy) when latest is exactly the threshold (12 days)", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [fa("2026-04-20")], // 12 days ago
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title.en).toBe("Fortnightly check is due");
    expect(items[0]?.body.en).toContain("12 days");
  });

  it("fires when latest is well past the threshold (20 days)", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [fa("2026-04-12")], // 20 days ago
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.body.en).toContain("20 days");
  });

  it("uses the most recent fortnightly even when given out-of-order list", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      // Most recent (April 25) is 7 days ago — should suppress.
      fortnightlies: [fa("2026-04-01"), fa("2026-04-25"), fa("2026-04-10")],
    });
    expect(items).toEqual([]);
  });

  it("suppresses entirely when redZoneActive is true", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [],
      redZoneActive: true,
    });
    expect(items).toEqual([]);
  });

  it("returns empty when todayISO is malformed (defensive)", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "not-a-date",
      fortnightlies: [],
    });
    expect(items).toEqual([]);
  });

  it("priority is between zone alerts (0–30) and discipline cadence (60s)", () => {
    const items = computeFortnightlyPrompt({
      todayISO: "2026-05-02",
      fortnightlies: [],
    });
    expect(items[0]?.priority).toBeGreaterThanOrEqual(40);
    expect(items[0]?.priority).toBeLessThan(60);
  });
});
