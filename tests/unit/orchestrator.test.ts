import { describe, it, expect } from "vitest";
import {
  proposeEvents,
  suggestionToFeedItem,
} from "~/lib/legacy/orchestrator";
import type { BiographicalOutline } from "~/types/legacy";
import type { TreatmentCycle } from "~/types/treatment";

function outline(
  chapter: string,
  overrides: Partial<BiographicalOutline> = {},
): BiographicalOutline {
  return {
    id: 1,
    chapter,
    arc_position: 1,
    target_depth: "rich",
    coverage: 0,
    family_coverage: { hulin: 0, catherine: 0, thomas: 0 },
    linked_entries: [],
    open_prompts: [],
    updated_at: "2026-04-24",
    ...overrides,
  };
}

function cycle(overrides: Partial<TreatmentCycle>): TreatmentCycle {
  return {
    id: 1,
    cycle_number: 4,
    start_date: "2026-04-01",
    status: "active",
    protocol_id: "GnP",
    ...overrides,
  } as TreatmentCycle;
}

describe("orchestrator — proposeEvents", () => {
  it("emits nothing during Orange zone", () => {
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "orange",
      cycles: [],
      outline: [],
    });
    expect(events).toHaveLength(0);
  });

  it("emits nothing during Red zone", () => {
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "red",
      cycles: [],
      outline: [],
    });
    expect(events).toHaveLength(0);
  });

  it("suggests a recovery outing mid-to-late cycle", () => {
    // Cycle started 2026-04-01 → today is day 23 → recovery phase.
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "green",
      cycles: [cycle({ start_date: "2026-04-01" })],
      outline: [],
    });
    const recovery = events.find((e) => e.theme === "recovery");
    expect(recovery).toBeDefined();
    expect(recovery?.title.en).toContain("outing");
  });

  it("suggests a quiet evening during nadir days", () => {
    // Start 2026-04-15 → today 2026-04-24 → day 9 → nadir window.
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "green",
      cycles: [cycle({ start_date: "2026-04-15" })],
      outline: [],
    });
    const recovery = events.find((e) => e.theme === "recovery");
    expect(recovery?.title.en).toContain("quiet");
  });

  it("proposes a chapter-gap evening when a chapter is sparse", () => {
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "green",
      cycles: [],
      outline: [
        outline("Origins", {
          target_depth: "essential",
          arc_position: 1,
          coverage: 0.1,
        }),
        outline("Career", {
          target_depth: "rich",
          arc_position: 4,
          coverage: 0.6,
        }),
      ],
    });
    const gap = events.find((e) => e.theme === "chapter_gap");
    expect(gap).toBeDefined();
    expect(gap?.chapter_hint).toBe("Origins");
  });

  it("ignores well-covered chapters for gap suggestions", () => {
    const events = proposeEvents({
      todayISO: "2026-04-24",
      zone: "green",
      cycles: [],
      outline: [
        outline("Origins", { coverage: 0.9, target_depth: "essential" }),
      ],
    });
    const gap = events.find((e) => e.theme === "chapter_gap");
    expect(gap).toBeUndefined();
  });

  it("adds a seasonal suggestion on Lunar New Year (Feb 17 proxy)", () => {
    const events = proposeEvents({
      todayISO: "2026-02-17",
      zone: "green",
      cycles: [],
      outline: [],
    });
    const seasonal = events.find((e) => e.theme === "seasonal");
    expect(seasonal).toBeDefined();
    expect(seasonal?.title.en).toContain("Lunar New Year");
  });

  it("strips suggestions already recently seen", () => {
    const events = proposeEvents({
      todayISO: "2026-02-17",
      zone: "green",
      cycles: [],
      outline: [],
      recent_suggestion_ids: ["seasonal:lunar-new-year:2026-02-17"],
    });
    const seasonal = events.find((e) => e.theme === "seasonal");
    expect(seasonal).toBeUndefined();
  });

  it("caps output at 2 suggestions per day", () => {
    // All the conditions fire at once: seasonal + chapter gap + nadir
    const events = proposeEvents({
      todayISO: "2026-02-17", // seasonal
      zone: "green",
      cycles: [cycle({ start_date: "2026-02-08" })], // day 9 → nadir
      outline: [outline("Origins", { coverage: 0.1 })], // chapter gap
    });
    expect(events.length).toBeLessThanOrEqual(2);
  });
});

describe("suggestionToFeedItem", () => {
  it("produces an invitation-category low-priority feed item with calendar CTA", () => {
    const item = suggestionToFeedItem({
      id: "test:1",
      theme: "lightness",
      title: { en: "A walk", zh: "散步" },
      body: { en: "Body", zh: "内容" },
    });
    expect(item.category).toBe("invitation");
    expect(item.priority).toBe(90);
    expect(item.tone).toBe("positive");
    expect(item.cta?.href).toBe("/schedule/new");
    expect(item.source).toBe("orchestrator");
  });
});
