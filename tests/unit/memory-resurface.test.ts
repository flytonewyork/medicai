import { describe, it, expect } from "vitest";
import { computeMemoryResurfaceFeedItems } from "~/lib/nudges/memory-resurface";
import type { LifeEvent } from "~/types/clinical";

function memory(
  id: number,
  event_date: string,
  title = "Phillip Island weekend",
): LifeEvent {
  return {
    id,
    title,
    event_date,
    category: "family",
    is_memory: true,
    created_at: event_date,
    updated_at: event_date,
  };
}

describe("computeMemoryResurfaceFeedItems", () => {
  it("resurfaces a 1-year anniversary", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [memory(1, "2025-04-24")],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title.en).toBe("1 year ago today");
    expect(items[0]?.category).toBe("memory");
    expect(items[0]?.tone).toBe("positive");
    expect(items[0]?.priority).toBe(95);
  });

  it("resurfaces a 2-year anniversary", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [memory(1, "2024-04-24")],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title.en).toBe("2 years ago today");
  });

  it("does not resurface off-anniversary years", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [
        memory(1, "2022-04-24"), // 4 years — not in allowed set
        memory(2, "2017-04-24"), // 9 years — not in allowed set
      ],
    });
    expect(items).toHaveLength(0);
  });

  it("resurfaces allowed multi-year anniversaries (3, 5, 10)", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [
        memory(1, "2023-04-24"), // 3 years ✓
        memory(2, "2021-04-24"), // 5 years ✓
        memory(3, "2016-04-24"), // 10 years ✓
      ],
    });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.title.en).sort()).toEqual([
      "10 years ago today",
      "3 years ago today",
      "5 years ago today",
    ]);
  });

  it("ignores life events that are not memories", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [
        { ...memory(1, "2025-04-24"), is_memory: false },
      ],
    });
    expect(items).toHaveLength(0);
  });

  it("ignores events on different calendar days", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [
        memory(1, "2025-04-23"),
        memory(2, "2025-04-25"),
        memory(3, "2025-05-24"),
      ],
    });
    expect(items).toHaveLength(0);
  });

  it("emits CTA pointing to /family/timeline", () => {
    const items = computeMemoryResurfaceFeedItems({
      todayISO: "2026-04-24",
      life_events: [memory(42, "2025-04-24")],
    });
    expect(items[0]?.cta?.href).toBe("/family/timeline#event-42");
  });
});
